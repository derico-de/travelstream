# ============================================================================
# DEXTERITY ROBOT TESTS
# ============================================================================
#
# Run this robot test stand-alone:
#
#  $ bin/test -s collective.travelstream -t test_ct_note.robot --all
#
# Run this robot test with robot server (which is faster):
#
# 1) Start robot server:
#
# $ bin/robot-server --reload-path src collective.travelstream.testing.COLLECTIVE_TRAVELSTREAM_ACCEPTANCE_TESTING
#
# 2) Run robot tests:
#
# $ bin/robot tests/robot/test_ct_note.robot
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

Scenario: As a site administrator I can add a Note
  Given a logged-in site administrator
    and an add Note form
   When I type 'My Note' into the title field
    and I submit the form
   Then a Note with the title 'My Note' has been created


*** Keywords *****************************************************************

# --- GIVEN ------------------------------------------------------------------

a logged-in site administrator
  Enable autologin as  Site Administrator

an add Note form
  Go To  ${PLONE_URL}/++add++Note

a Note '${title}'
  Create content  type=Note  id=my-note  title=${title}

# --- WHEN -------------------------------------------------------------------

I type '${title}' into the title field
  Input Text  name=form.widgets.IBasic.title  ${title}

I submit the form
  Click Button  Save

I go to the Note view
  Go To  ${PLONE_URL}/my-note
  Wait until page contains  Site Map


# --- THEN -------------------------------------------------------------------

a Note with the title '${title}' has been created
  Wait until page contains  Site Map
  Page should contain  ${title}
  Page should contain  Item created

I can see the Note title '${title}'
  Wait until page contains  Site Map
  Page should contain  ${title}
