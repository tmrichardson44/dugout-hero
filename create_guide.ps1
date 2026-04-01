$outputPath = [System.IO.Path]::Combine([Environment]::GetFolderPath("Desktop"), "Lineup Hero - User Guide.docx")

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Add()
$sel = $word.Selection

function H1($t) {
    $sel.Style = $doc.Styles["Heading 1"]
    $sel.TypeText($t)
    $sel.TypeParagraph()
    $sel.Style = $doc.Styles["Normal"]
}
function H2($t) {
    $sel.Style = $doc.Styles["Heading 2"]
    $sel.TypeText($t)
    $sel.TypeParagraph()
    $sel.Style = $doc.Styles["Normal"]
}
function H3($t) {
    $sel.Style = $doc.Styles["Heading 3"]
    $sel.TypeText($t)
    $sel.TypeParagraph()
    $sel.Style = $doc.Styles["Normal"]
}
function P($t) {
    $sel.Style = $doc.Styles["Normal"]
    $sel.TypeText($t)
    $sel.TypeParagraph()
}
function LB($t) {
    $sel.Style = $doc.Styles["List Bullet"]
    $sel.TypeText($t)
    $sel.TypeParagraph()
    $sel.Style = $doc.Styles["Normal"]
}
function LN($t) {
    $sel.Style = $doc.Styles["List Number"]
    $sel.TypeText($t)
    $sel.TypeParagraph()
    $sel.Style = $doc.Styles["Normal"]
}
function Note($t) {
    $sel.Style = $doc.Styles["Normal"]
    $sel.Font.Italic = $true
    $sel.Font.Color = 0x606060
    $sel.TypeText("Note: $t")
    $sel.TypeParagraph()
    $sel.Font.Italic = $false
    $sel.Font.Color = -16777216
}
function Br() {
    $sel.Style = $doc.Styles["Normal"]
    $sel.TypeParagraph()
}

# Title
$sel.Style = $doc.Styles["Title"]
$sel.TypeText("Lineup Hero")
$sel.TypeParagraph()
$sel.Style = $doc.Styles["Subtitle"]
$sel.TypeText("Step-by-Step Guide for Coaches")
$sel.TypeParagraph()
$sel.Style = $doc.Styles["Normal"]
Br

# ── 1. Getting Started
H1 "1. Getting Started"
LN "Open a web browser and go to the Lineup Hero website."
LN "Click Sign In to Pro on the home page."
LN "Click 'Need an account? Sign up'."
LN "Enter your full name, email, and a password, then click Sign Up."
LN "You will land on your dashboard."
Br

# ── 2. Create Your Team
H1 "2. Create Your Team"
LN "On the dashboard, click New Team (green button) in the My Teams section."
LN "Type your team name (example: Padres)."
LN "Choose your Program from the dropdown (example: Hopkinton Little League)."
LN "Click Create Team."
LN "Click your new team to open it."
Br

# ── 3. Season Setup
H1 "3. Configure Your Season Settings"
P "Inside your team, tap the Setup tab at the bottom of the screen."
Br
LB "Team Name – Confirm or update the name."
LB "Roster Size – Enter the number of players on your team."
LB "Innings – Set how many innings are in each game."
LB "League – If your team is part of a league you manage, select it here."
LB "Rotation Positions – Tap each position to turn it on (green) or off. Only green positions will be used when building the fielding rotation."
Br
P "Tap Save Seasonal Framework when finished."
Br

# ── 4. Add Players
H1 "4. Add Your Players"
P "Tap the Team tab at the bottom of the screen."
Br
LN "Tap the green + button in the top right."
LN "Enter the player's name and jersey number."
LN "Set Throws (R/L) and Bats (R/L/Switch)."
LN "If this player can pitch, tap the Pitcher button (turns blue)."
LN "If this player can catch, tap the Catcher button (turns red)."
LN "Tap Save. Repeat for every player."
Br
Note "Only players tagged as Pitcher or Catcher will ever be placed at those positions by the auto-balance tool."
Br

# ── 5. Add Games
H1 "5. Add Your Games"
P "Tap the Games tab at the bottom of the screen."
Br
LN "Tap New Game."
LN "Enter the opponent name, date, time, and location."
LN "Toggle Home or Away as needed."
LN "Tap the game to open it and set lineups."
Br

# ── 6. Fielding Rotation
H1 "6. Set the Fielding Rotation"
P "Open a game, then tap the Fielding tab."
Br
H2 "Auto-Balance (Recommended)"
LN "Tap the Auto-Balance button (wand icon, top right)."
LN "The app assigns positions for each inning, rotating players fairly."
LN "Pitchers and catchers will only go to their positions – all other players rotate through the remaining spots."
LN "Adjust any individual cell using the dropdown if needed."
Br
H2 "Manual Assignment"
LN "Use the dropdown under each inning to pick a position or set Bench."
LN "Mark a player absent by tapping the green check next to their name – absent players are excluded from the rotation."
Br
Note "A cell highlighted in red means two players share the same position in that inning. Fix it before printing."
Br

# ── 7. Batting Order
H1 "7. Set the Batting Order"
P "Open a game, then tap the Batting tab."
Br
H2 "Auto-Balance (Recommended)"
LN "Tap the Auto-Balance button (wand icon)."
LN "The app builds a batting order designed to bring every player's season average toward the target range over time."
LN "Players batting too early on average will get later slots this game; players batting too late will get earlier slots."
LN "The first 3-4 games will look somewhat random – that is normal. By game 5 the order visibly converges."
Br
H2 "Manual / Drag-and-Drop"
LN "Use each slot's dropdown to assign a player."
LN "Drag the grip handle on the left to reorder any slot manually."
Br

# ── 8. Print the Lineup Sheet
H1 "8. Print the Lineup Sheet"
LN "Open a game, then tap the Sheet tab."
LN "Review the formatted lineup card showing batting order and fielding rotation by inning."
LN "Tap Export PDF to print or save the file."
Br
Note "The sheet is formatted to fit on one landscape page. Use landscape orientation when printing."
Br

# ── 9. Lineup Trends
H1 "9. Track Lineup Trends"
P "Tap the Lineup Trends tab (bar chart icon, bottom nav)."
Br
LB "Each player shows their average batting position across all games this season."
LB "Green = their average is within the target range. Red = they need correction."
LB "Use Auto-Balance batting each game to naturally pull outliers back into range over time."
Br

# ── League Admin
H1 "10. League Admin (If You Run a League)"
P "If you manage multiple teams in a league:"
Br
LN "From the dashboard, click New League in the My Leagues section."
LN "Enter the league name and program, then click Create League."
LN "Open the league and click Add Team to add your existing teams."
LN "On each team card, click the email icon to assign a coach. The coach must already have a Lineup Hero account."
LN "The league dashboard shows batting average stats for every team in the league."
Br
Note "Coaches you assign can log in and manage their team's roster, games, and lineups independently."
Br

# ── Tips
H1 "Quick Tips"
LB "Run Auto-Balance for both fielding and batting every game – it improves as the season goes on."
LB "Only flag players as Pitcher or Catcher if they genuinely play those positions."
LB "Mark absent players first, then run Auto-Balance."
LB "Your data saves automatically – no need to do anything after clicking buttons."
LB "The app works on any device with a modern web browser – phone, tablet, or computer."

# Save
$doc.SaveAs2($outputPath, 16)
$doc.Close()
$word.Quit()

Write-Host "Saved to: $outputPath"
