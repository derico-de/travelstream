# Travelstream

Self-hosted travel content hub: capture archive, curation space and public blog in one Plone site

## Features

- Compatible with Plone 6.0+

## Installation

Add `collective.travelstream` to your project's dependencies:

```python
# In your pyproject.toml
dependencies = [
    "collective.travelstream",
    # ...
]
```

Then activate the addon in your Plone site's control panel or via GenericSetup.

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/collective/collective.travelstream.git
cd collective.travelstream

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install in development mode
pip install -e ".[test]"
```

### Running Tests

```bash
pytest
```

### Running Tests with Coverage

```bash
pytest --cov=collective.travelstream --cov-report=html
```

## License

GPL-2.0-or-later

## Author

MrTango <md@derico.de>
