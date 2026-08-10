"""Pytest configuration for collective.travelstream tests."""
from pytest_plone import fixtures_factory

from collective.travelstream.testing import FUNCTIONAL_TESTING
from collective.travelstream.testing import INTEGRATION_TESTING


globals().update(
    fixtures_factory(
        (
            (INTEGRATION_TESTING, "integration"),
            (FUNCTIONAL_TESTING, "functional"),
        )
    )
)
