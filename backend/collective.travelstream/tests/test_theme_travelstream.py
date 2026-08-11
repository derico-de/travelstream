"""Test the Travelstream theme is installed and active."""
import pytest
from plone import api
from plone.app.testing import setRoles
from plone.app.testing import TEST_USER_ID


THEME_ID = "travelstream"


class TestThemeTravelstream:
    """Verify the theme profile installs and the theme is active."""

    @pytest.fixture(autouse=True)
    def _setup(self, integration):
        self.portal = integration["portal"]
        setRoles(self.portal, TEST_USER_ID, ["Manager"])

    def test_theme_installed(self):
        """The theme resource directory is registered."""
        from plone.resource.utils import iterDirectoriesOfType

        theme_ids = [d.__name__ for d in iterDirectoriesOfType("theme")]
        assert THEME_ID in theme_ids

    def test_theme_is_current(self):
        """The installed theme is the current (active) theme."""
        from plone.app.theming.utils import getCurrentTheme

        assert getCurrentTheme() == THEME_ID

    def test_theming_enabled(self):
        """Diazo theming is enabled in the registry."""
        enabled = api.portal.get_registry_record(
            "plone.app.theming.interfaces.IThemeSettings.enabled"
        )
        assert enabled is True

    def test_production_css_exists(self):
        """The manifest's production-css points at a file that ships with the theme."""
        from plone.app.theming.utils import getTheme
        from plone.resource.utils import queryResourceDirectory

        theme = getTheme(THEME_ID)
        prefix = f"/++theme++{THEME_ID}/"
        assert theme.production_css.lstrip("/").startswith(prefix.lstrip("/"))
        relative_path = theme.production_css.lstrip("/")[len(prefix.lstrip("/")):]

        directory = queryResourceDirectory("theme", THEME_ID)
        assert directory.isFile(relative_path), (
            f"{theme.production_css} is declared in manifest.cfg but "
            f"{relative_path} does not exist in the theme directory - "
            "run `npm install && npm run build` in the theme folder"
        )
        css = directory.readFile(relative_path)
        assert b"travel-article-body" in css
