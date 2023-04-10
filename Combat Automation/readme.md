All macros in this folder require you to create a new macro called CombatAutomationHelpers and paste the code from the CombatAutomationHelpers.js into it. 

You can also update the formula for both Trick Attack damage entries in the Trick Attack (Ex) class feature to (I prefer how this looks):
(lookupRange(@classes.operative.levels, 1, 5, 3 + floor((@classes.operative.levels - 5) / 2)))d(lookupRange(@classes.operative.levels, 4, 3, 8))

Sniper / other alternative trick attack replacements are still WIP, don't expect them to calculate correctly