# ============================================================================
# DEXTERITY ROBOT TESTS
# ============================================================================
#
# Run this robot test stand-alone:
#
#  $ bin/test -s collective.travelstream -t test_ct_trip.robot --all
#
# Run this robot test with robot server (which is faster):
#
# 1) Start robot server:
#
# $ bin/robot-server --reload-path src collective.travelstream.testing.COLLECTIVE_TRAVELSTREAM_ACCEPTANCE_TESTING
#
# 2) Run robot tests:
#
# $ bin/robot tests/robot/test_ct_trip.robot
#
# See the http://docs.plone.org for further details (search for robot
# framework).
#
# ============================================================================

*** Settings *****************************************************************

Resource  plone/app/robotframework/selenium.robot
Resource  plone/app/robotframework/keywords.robot

Library  Remote  ${PLONE_URL}/RobotRemote

Test Setup  Open test browser
Test Teardown  Close all browsers


*** Test Cases ***************************************************************

Scenario: As a site administrator I can add a Trip
  Given a logged-in site administrator
    and an add Trip form
   When I type 'My Trip' into the title field
    and I submit the form
   Then a Trip with the title 'My Trip' has been created


*** Keywords *****************************************************************

# --- GIVEN ------------------------------------------------------------------

a logged-in site administrator
  Enable autologin as  Site Administrator

an add Trip form
  Go To  ${PLONE_URL}/++add++Trip

a Trip '${title}'
  Create content  type=Trip  id=my-trip  title=${title}

# --- WHEN -------------------------------------------------------------------

I type '${title}' into the title field
  Input Text  name=form.widgets.IBasic.title  ${title}

I submit the form
  Click Button  Save

I go to the Trip view
  Go To  ${PLONE_URL}/my-trip
  Wait until page contains  Site Map


# --- THEN -------------------------------------------------------------------

a Trip with the title '${title}' has been created
  Wait until page contains  Site Map
  Page should contain  ${title}
  Page should contain  Item created

I can see the Trip title '${title}'
  Wait until page contains  Site Map
  Page should contain  ${title}
