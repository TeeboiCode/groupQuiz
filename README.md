# Group Quiz

From this project folder, start a local web server:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000/ in your browser and click Start. Stop the server with Ctrl+C.

Do not open the HTML files directly with `file://`: browsers block fetching `db.json` that way. In VS Code, Live Server's **Open with Live Server** also works.

Edit `db.json` to update the questions. The quiz displays one button per question.

## Answer reveal

Each question in `db.json` includes `answer` and `explanation` text. The host clicks **Show answer** to reveal both and stop the timer. Running out of time never reveals the answer automatically. HTML examples are displayed as text.

Bonus rounds and bonus scoring are disabled. The host grades each revealed answer with the **Correct** or **Incorrect** button.

Bootstrap answers use the default Bootstrap 5 conventions. Reference: https://getbootstrap.com/docs/5.3/utilities/spacing/

## Scoring flow

Before the quiz, the host chooses either **Web Development** or **All Departments**, creates 2 to 5 groups, and chooses each group’s name and color. The setup also controls the question timer, winning score, and points awarded for a correct answer. Turns rotate through every group after each graded answer. The active group has a green card in the top navigation.

All Departments questions display four multiple-choice options. Revealing the answer highlights the correct option before the host grades the group. Web Development questions keep the original question-and-answer layout.

Each grading decision opens a score notification for five seconds. The setup, scores, current turn, shuffled question order, and completed questions are saved in local storage and survive a refresh. Use **New setup** to clear the complete game and return to group setup.

After an answer is graded, its disabled challenge box uses the answering group’s assigned color. This ownership also survives a refresh.

The first group to reach the configured winning score opens the centered winner modal. The host can continue playing with the current scores or start a new setup.
