"""extract_exif_metadata event handler.

Stamps ``captured_at`` and geolocation from EXIF onto Images located inside
a Trip, synchronously, before reindexing — the values must exist before the
object first appears on the timeline. Objects outside a Trip are never
touched. Values are only written when the EXIF data actually carries them,
so client-supplied values survive photos without EXIF.
"""

import logging
from datetime import datetime
from io import BytesIO

from collective.travelstream.content.trip import ITrip
from collective.travelstream.subscribers import addon_installed
from PIL import ExifTags
from PIL import Image as PILImage
from PIL import UnidentifiedImageError


logger = logging.getLogger("collective.travelstream")

# EXIF tag ids
_DATETIME_ORIGINAL = 0x9003
_DATETIME_DIGITIZED = 0x9004
_GPS_LAT_REF = 1
_GPS_LAT = 2
_GPS_LON_REF = 3
_GPS_LON = 4


def _inside_trip(obj):
    parent = getattr(obj, "aq_parent", None)
    while parent is not None:
        if ITrip.providedBy(parent):
            return True
        parent = getattr(parent, "aq_parent", None)
    return False


def _parse_exif_datetime(value):
    try:
        return datetime.strptime(str(value).strip(), "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None


def _dms_to_decimal(dms, ref):
    try:
        degrees, minutes, seconds = (float(part) for part in dms)
    except (TypeError, ValueError):
        return None
    decimal = degrees + minutes / 60.0 + seconds / 3600.0
    if str(ref).upper() in ("S", "W"):
        decimal = -decimal
    return round(decimal, 7)


def extract_exif(data):
    """Return (captured_at, latitude, longitude) from image bytes.

    Every element is None when the EXIF data does not carry it.
    """
    try:
        image = PILImage.open(BytesIO(data))
        exif = image.getexif()
    except (UnidentifiedImageError, OSError, ValueError):
        return None, None, None
    if not exif:
        return None, None, None

    exif_ifd = exif.get_ifd(ExifTags.IFD.Exif)
    raw_dt = (
        exif_ifd.get(_DATETIME_ORIGINAL)
        or exif_ifd.get(_DATETIME_DIGITIZED)
        or exif.get(0x0132)  # top-level DateTime
    )
    captured_at = _parse_exif_datetime(raw_dt) if raw_dt else None

    latitude = longitude = None
    gps = exif.get_ifd(ExifTags.IFD.GPSInfo)
    if gps and _GPS_LAT in gps and _GPS_LON in gps:
        latitude = _dms_to_decimal(gps[_GPS_LAT], gps.get(_GPS_LAT_REF, "N"))
        longitude = _dms_to_decimal(gps[_GPS_LON], gps.get(_GPS_LON_REF, "E"))

    return captured_at, latitude, longitude


def handler(obj, event):
    """Handle object added/modified for ``IImage`` inside a Trip."""
    if not addon_installed():
        return
    if not _inside_trip(obj):
        return

    image_field = getattr(obj, "image", None)
    data = getattr(image_field, "data", None)
    if not data:
        return

    captured_at, latitude, longitude = extract_exif(data)

    changed = []
    if captured_at is not None:
        obj.captured_at = captured_at
        changed.append("captured_at")
    if latitude is not None and longitude is not None:
        obj.latitude = latitude
        obj.longitude = longitude
        changed.extend(["latitude", "longitude"])

    if changed:
        obj.reindexObject(idxs=changed)
        logger.info(
            "extract_exif_metadata: stamped %s on %s",
            ", ".join(changed),
            obj.absolute_url(),
        )
