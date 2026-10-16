---
title: Algorithms and Scratch
subject: computing
level: b8
topic: Algorithms and Scratch
description: Think in clear steps, draw them as flowcharts, add loops and decisions, then build a working program in Scratch.
color: #12608a
---
## Telling a machine what to do

Ask Abena to make tea and she will manage. She knows to boil the water first, and that "add sugar" means a spoonful, not the whole tin. A computer knows none of this. It does exactly what it is told, in exactly the order it is told, and nothing more.

That is why computing starts not with a keyboard but with **thinking in steps**. A set of clear steps that solves a problem is called an **algorithm**. Writing an algorithm in a language a computer can run is called **programming**.

In this book you will learn to:

- break a task into **steps** in the right **sequence**
- draw an algorithm as a **flowchart**
- repeat steps with **loops**
- make choices with **conditions**
- build, test and fix a real program in **Scratch**, a free, visual programming language from MIT

You will need access to a computer with a browser, or the Scratch app on a phone or tablet. If you do not have one today, you can still do every thinking task with pencil and paper, which is how all programs begin.
===
## What is an algorithm?

An **algorithm** is a precise list of steps that, followed in order, solves a problem or completes a task.

Algorithms are everywhere, and most have nothing to do with computers:

- a **recipe** for jollof rice
- the **instructions** on a sachet of Oral Rehydration Salts
- the steps a **mate** follows to collect trotro fares
- the **method** you use to do long division
- the **directions** you give a stranger to the lorry station

A good algorithm has four qualities:

1. **Clear** – every step means one thing only.
2. **Ordered** – the steps are in the right sequence.
3. **Finite** – it finishes.
4. **Effective** – it actually solves the problem.

"Cook the rice until it is ready" fails the first test: what is "ready"? "Cook for 20 minutes on a low fire, then taste a grain" passes.

### Try this

Write an algorithm, in no more than eight steps, for washing your hands properly. Give it to a friend to follow exactly. Did they do anything you did not expect?
===
## Sequence: order matters

@image https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Pounding_Fufu_in_Ghana.jpg/960px-Pounding_Fufu_in_Ghana.jpg | Pounding fufu: boil, then pound, then shape. Change the order and there is no fufu | aripeskoe2 · CC BY 2.0 | https://commons.wikimedia.org/wiki/File:Pounding_Fufu_in_Ghana.jpg

**Sequence** means doing steps one after another in a fixed order. It is the simplest building block of every algorithm, and it is where most mistakes hide.

Here is an algorithm for making fufu. Spot the problem.

1. Pound the cassava and plantain.
2. Peel the cassava and plantain.
3. Boil them until soft.
4. Shape into balls.

Step 1 cannot happen before steps 2 and 3. Pounding raw, unpeeled cassava gives you a mess, not fufu. The correct sequence is 2, 3, 1, 4.

Computers follow sequence exactly. If you tell a Scratch character to *say "Hello"* and then *move 10 steps*, it says hello first, every time. Swap the two blocks and the behaviour changes.

### Try this

Here are the steps for sending a WhatsApp message, shuffled: *type the message; open WhatsApp; press send; choose the contact.* Put them in the correct sequence. Is there more than one correct order?
===
## Being precise

@video 6hfOvs8pY1k | What's an algorithm? - David J. Malan | TED-Ed

Try this with a friend. One of you is the **robot** and must do exactly what is said, no more. The other gives instructions to make the robot draw a square on paper.

"Draw a square" is not allowed; the robot only knows: *put pen down*, *move forward N cm*, *turn right 90°*, *lift pen up*.

A first attempt often goes:

> Put pen down. Move forward 5 cm. Turn right. Move forward 5 cm. Turn right. Move forward 5 cm. Turn right. Move forward 5 cm.

A good robot asks: *Turn right by how much?* Fix it: *Turn right 90°*.

What happens at the end? The pen is still down. If the next instruction is *move forward 10 cm*, you get a tail on your square. Add *lift pen up*.

This is **debugging**: finding and fixing mistakes in an algorithm. Every programmer, from a Basic 8 pupil to the engineers at Google, spends most of their time doing it. The computer is not being stupid when it misbehaves; it is doing precisely what you said.
===
## Decomposition: breaking it down

Big problems are solved by cutting them into smaller ones. This is called **decomposition**.

Suppose you want to make a Scratch game where a cat catches falling mangoes. That sounds hard. Decompose it:

1. Make a cat that moves left and right with the arrow keys.
2. Make a mango that falls from the top of the screen.
3. When the mango reaches the bottom, send it back to the top at a random place.
4. When the mango touches the cat, add one to the score and send the mango back to the top.
5. Show the score on screen.
6. Stop the game after 60 seconds.

Each small problem can be solved and tested on its own. If the cat moves correctly, you never need to touch that part again while you work on the mango.

Decomposition also makes teamwork possible: Kofi writes the cat, Ama writes the mango, and the pieces fit together.

### Try this

Decompose "organise an inter-class football match" into six or seven smaller tasks.
===
## Flowcharts: drawing an algorithm

@image https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/LampFlowchart.svg/960px-LampFlowchart.svg.png | A classic flowchart: fixing a lamp that does not work | Booyabazooka, Wapcaplet · CC BY-SA 3.0 | https://commons.wikimedia.org/wiki/File:LampFlowchart.svg

A **flowchart** is a diagram of an algorithm. It shows the steps as shapes and the order as arrows. Flowcharts are useful because you can **see** the whole algorithm at once, including where decisions are made.

The standard shapes:

| Shape | Name | Used for |
|---|---|---|
| Rounded box (oval) | **Terminal** | Start and Stop |
| Rectangle | **Process** | an action: *add sugar*, *score = score + 1* |
| Parallelogram | **Input/Output** | *ask for a name*, *display the total* |
| Diamond | **Decision** | a yes/no question: *Is it plugged in?* |
| Arrows | **Flow lines** | the order of steps |

Rules:

- One **Start** and (usually) one **Stop**.
- Arrows show direction; they normally flow top to bottom.
- A **decision** has exactly **two** arrows out, labelled **Yes** and **No**.
- Every shape except Stop has an arrow out.

The lamp flowchart above shows them all: a problem, two decisions, actions for each case, and an end.
===
## Reading a flowchart

Read a flowchart by starting at **Start** and following the arrows, doing what each box says. At a diamond, answer the question and follow the matching arrow.

Trace this one for buying waakye:

> **Start** → *Join the queue* → *Is it your turn?* **No** → *Wait* → back to *Is it your turn?* … **Yes** → *Say how much you want* → *Pay* → *Do you want pepper?* **Yes** → *Add pepper* → *Collect your food* → **Stop**. (If **No**, skip *Add pepper* and go straight to *Collect your food*.)

Notice two things:

- The first decision sends you **back** in a circle until the answer is yes. That is a **loop**.
- The second decision sends you **one of two ways** and then both paths join up again. That is a **selection**, or a condition.

Those two patterns, plus sequence, are enough to describe any algorithm ever written.

### Try this

Draw the waakye flowchart with the correct shapes, labelling each decision's Yes and No arrows.
===
## Drawing your own flowchart

Let us draw a flowchart for **checking whether a pupil passed a test**, where the pass mark is 50.

1. **Start** (oval)
2. *Input the mark* (parallelogram)
3. *Is mark ≥ 50?* (diamond)
   - **Yes** → *Output "Pass"* (parallelogram)
   - **No** → *Output "Fail"* (parallelogram)
4. Both arrows join → **Stop** (oval)

Tips for tidy flowcharts:

- Plan in words first, as a numbered list.
- Draw in pencil; you will move things.
- Keep text inside shapes short: a verb and an object.
- Make the **Yes** and **No** labels impossible to miss.
- If arrows cross, redraw; crossing lines cause mistakes.

### Try this

Draw a flowchart for a trotro mate deciding the fare: if the passenger is a child, charge GH₵1; otherwise charge GH₵2. Then extend it: if the passenger is going past the market, add GH₵1.
===
## Recap: steps and flowcharts

- An **algorithm** is a clear, ordered, finite, effective list of steps that solves a problem.
- **Sequence** means the order of steps; computers follow it exactly.
- **Precision** matters: "turn right" is not enough; "turn right 90°" is.
- **Debugging** is finding and fixing mistakes in an algorithm or program.
- **Decomposition** breaks a big task into small ones that can be built and tested separately.
- A **flowchart** draws an algorithm: ovals for Start/Stop, rectangles for actions, parallelograms for input/output, diamonds for yes/no decisions, arrows for order.
- Two patterns appear in flowcharts again and again: going **back** (a loop) and going **one of two ways** (a selection).

### Quick quiz

1. Name the four qualities of a good algorithm.
2. Which flowchart shape is used for a decision?
3. How many arrows leave a decision shape?
4. What is decomposition?
5. Draw the flowchart for: *Start; ask for a number; if it is even, output "even", else output "odd"; stop.*
===
## Loops: doing it again

A **loop** repeats a step or a group of steps. Without loops, drawing a square would need eight instructions; with a loop it needs three.

> **Repeat 4 times:**
>   move forward 5 cm
>   turn right 90°

There are two main kinds of loop.

**Count-controlled loop** – repeats a fixed number of times. *Repeat 4 times.* *Repeat 10 times.* You know in advance how many.

**Condition-controlled loop** – repeats **until** something is true, or **while** something is true. *Repeat until the mango touches the cat.* *Wait while the light is red.* You do not know how many times; it depends on what happens.

Scratch has a third: **forever**, which repeats until the program is stopped. Games use it to keep checking for key presses.

Loops are why computers are useful. Nobody wants to write *add the next mark* 300 times to total a school's test results. *Repeat for every pupil: add their mark* does it in one line, for 30 pupils or 3,000.

### Try this

Rewrite these as a loop: *Clap. Clap. Clap. Clap. Clap. Stamp.*
===
## Loops in a flowchart

In a flowchart a loop is an arrow that goes **back up**. The decision diamond is the gate that decides whether to go round again.

**Counting to 10:**

> Start → *count = 1* → *Output count* → *count = count + 1* → *Is count > 10?* **No** → back to *Output count* … **Yes** → Stop

Trace it: output 1, count becomes 2, is 2 > 10? No, go back. Output 2 … Output 10, count becomes 11, is 11 > 10? Yes, stop. Ten numbers printed.

**Waiting for the light:**

> Start → *Is the light green?* **No** → *Wait 1 second* → back to the question … **Yes** → *Cross the road* → Stop

The first is count-controlled; the second is condition-controlled. In both, if the decision could **never** become Yes, the loop would run **forever**: an **infinite loop**, one of the commonest bugs. (What if the light is broken?)

### Try this

Draw a flowchart that outputs the 5-times table from 5 to 50 using a loop. What must be true for the loop to stop?
===
## Conditions: making choices

A **condition** is a question with a yes/no (true/false) answer. **Selection** means choosing what to do depending on the answer.

In words: *If it is raining, take an umbrella.*

In a flowchart: a diamond.

In most programming languages, including Scratch:

> **if** <it is raining> **then**
>   take an umbrella

With two choices:

> **if** <mark ≥ 50> **then**
>   say "Pass"
> **else**
>   say "Fail"

Conditions are built from **comparisons**: equals (=), greater than (>), less than (<). You can join them with **and**, **or** and **not**:

- *if* <temperature > 30> **and** <it is not raining> *then* say "Go to the beach"
- *if* <key space pressed> **or** <mouse down> *then* jump

Every decision a computer seems to make, from a traffic light changing to a phone unlocking with your face, is a condition like these, checked thousands of times a second.
===
## Combining the three

Sequence, loops and conditions combine to describe anything. Here is an algorithm for a **mate** collecting fares on a trotro with 15 seats:

> **Start**
> total = 0
> **Repeat 15 times:**
>   ask the passenger for their stop
>   **if** <stop is before the market> **then**
>     fare = 2
>   **else**
>     fare = 3
>   collect fare
>   total = total + fare
> output total
> **Stop**

Look for the pieces: a **sequence** of steps; a **count-controlled loop** (15 times); a **selection** inside the loop choosing the fare; a **variable** (total) that stores a changing value.

The indentation shows what is **inside** the loop and what is inside the **if**. In Scratch the blocks physically wrap around their contents, so you can see this nesting.

### Try this

Change the algorithm so that children pay half fare. Where does the new condition go?
===
## Variables: remembering things

A **variable** is a named box where a program stores a value that can change: a score, a count, a name, a fare.

In the mate's algorithm, **total** was a variable. It started at 0 and grew with every fare. **fare** was another; its value changed depending on the stop.

Rules of thumb:

- **Name** variables for what they hold: *score*, *lives*, *total*, not *x* or *thing*.
- **Set** a starting value before you use it. A score that starts at nothing is a bug.
- **Change** it with a clear step: *change score by 1*, *set total to total + fare*.

Maths uses letters for unknowns; programming uses variables for values that **change over time**. The equation *total = total + fare* would be nonsense in maths, but in a program it means "take the current total, add the fare, and store the result back in total".

In Scratch, variables live in the orange **Variables** category. You make one with *Make a Variable*, then use *set*, *change* and the round reporter block that shows its value.
===
## Recap: loops, conditions, variables

- A **loop** repeats steps: **count-controlled** (*repeat 4*), **condition-controlled** (*repeat until*, *while*) or **forever**.
- In a flowchart a loop is an arrow going **back**; a decision diamond is the gate. A loop whose gate never opens is an **infinite loop**.
- A **condition** is a yes/no question built from comparisons (=, <, >) and joined with **and / or / not**.
- **Selection** uses *if … then* or *if … then … else* to choose between paths.
- A **variable** is a named store for a changing value: set it first, then change it.
- **Sequence + loops + selection + variables** can express any algorithm.

### Quick quiz

1. Which kind of loop would you use to walk until you reach the gate?
2. What goes wrong if a variable is never given a starting value?
3. Write *if … else* instructions for a shop: free delivery if the order is GH₵100 or more, otherwise GH₵10 delivery.
4. Draw a flowchart that counts down from 10 to 1 and then outputs "Go!".
===
## Meet Scratch

@image https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Scratch_3.0_editor.png/960px-Scratch_3.0_editor.png | The Scratch 3.0 editor: block palette on the left, scripts in the middle, stage on the right | Wikimedia Commons contributor (screenshot of Scratch, MIT) · CC BY-SA 2.0 | https://commons.wikimedia.org/wiki/File:Scratch_3.0_editor.png

**Scratch** is a free programming language made by the Lifelong Kindergarten group at MIT. Instead of typing code, you snap together coloured **blocks**, like Lego. It runs in a web browser at **scratch.mit.edu**, and there is an offline app for computers and tablets.

The screen has three main parts:

- **Stage** (top right) – where your program runs. It is 480 wide by 360 high.
- **Sprites** – characters or objects on the stage. Each sprite has its own scripts, costumes and sounds. The default is the orange **Scratch Cat**.
- **Block palette** (left) – blocks grouped by colour: **Motion** (blue), **Looks** (purple), **Sound** (pink), **Events** (yellow), **Control** (orange), **Sensing** (light blue), **Operators** (green), **Variables** (dark orange).
- **Scripts area** (middle) – where you drag blocks and snap them together.

A **script** is a stack of blocks starting with a **hat block** (an Event, such as *when green flag clicked*). Click the green flag above the stage to run every script that begins that way; the red stop sign halts everything.
===
## Your first script

@video ssoRNCtmhVM | Getting Started with Scratch | Scratch Team

Open Scratch and click **Create**. Follow these steps exactly, then experiment.

1. In **Events** (yellow), drag *when green flag clicked* into the scripts area.
2. In **Looks** (purple), drag *say Hello! for 2 seconds* and snap it underneath. Click the text and change it to *Akwaaba!*
3. In **Motion** (blue), drag *move 10 steps* and snap it under the say block. Change 10 to 50.
4. In **Sound** (pink), drag *play sound Meow until done* and snap it on.
5. Click the **green flag**.

The cat greets you, slides to the right and meows. You have written a **sequence** of four instructions.

Now **debug**: click the flag again. The cat moves another 50 steps. Keep going and it leaves the stage. Fix it by adding, right after the hat block, *go to x: 0 y: 0* from Motion. Now every run starts in the middle.

Save your project with a name (**File → Save to your computer**, or sign in to save online).
===
## Scratch Cat draws a square

Let us turn the robot square from earlier into a program. Add the **Pen** extension: click the blue button at the bottom left of the palette and choose **Pen**.

Script:

> when green flag clicked
> erase all
> go to x: 0 y: 0
> point in direction 90
> pen down
> repeat 4
>   move 100 steps
>   turn ↻ 90 degrees
> pen up

Run it. A square appears behind the cat.

Now experiment, one change at a time:

- Change *repeat 4* to *repeat 3* and the turn to **120** degrees. A triangle.
- *repeat 6*, turn **60**. A hexagon.
- *repeat 36*, turn **10**, move **20**. Almost a circle.

Do you see the pattern? The number of repeats times the turn angle is always **360**. That is a mathematical fact about going round any shape once, and your program just proved it.

### Try this

Put the square script inside *repeat 12* with *turn 30 degrees* after the inner loop. Run it before you read the next sentence. You have made a flower.
===
## Loops in Scratch

@video 11gESTba3eU | Scratch 4: loops and conditionals | TwinsTeachTech

The **Control** category (orange) holds Scratch's loops. Each is a C-shaped block that wraps around the blocks it repeats.

**repeat (10)** – count-controlled. Runs the inside blocks the given number of times.

**forever** – runs until the stop sign is clicked. Nothing can go under it, because it never ends. Used for game loops that keep checking keys and collisions.

**repeat until <  >** – condition-controlled. Keeps going until the condition in the hexagonal slot becomes true.

**wait (1) seconds** – not a loop, but you will use it inside loops to slow things down so you can see what happens.

A bouncing cat:

> when green flag clicked
> forever
>   move 10 steps
>   if on edge, bounce

A cat that walks to the right edge and stops:

> when green flag clicked
> go to x: -200 y: 0
> repeat until <(x position) > 200>
>   move 5 steps

### Try this

Make the cat change costume every time it moves (Looks → *next costume*, inside the loop, with *wait 0.1*). It walks.
===
## Conditions in Scratch

Scratch has three condition blocks in **Control**: *if < > then*, *if < > then … else*, and *wait until < >*. The hexagonal slot takes a **Boolean**: anything that is true or false.

Booleans come from:

- **Sensing** (light blue): *touching [mouse-pointer]?*, *key [space] pressed?*, *touching color?*
- **Operators** (green): *< >*, *= *, *> *, *and*, *or*, *not*

Making the cat move with the arrow keys:

> when green flag clicked
> forever
>   if <key [right arrow] pressed?> then
>     change x by 10
>   if <key [left arrow] pressed?> then
>     change x by -10

Why is the *if* inside a *forever*? Because a condition is checked **once** when the program reaches it. Inside a forever loop it is checked again and again, so the cat responds whenever a key is held down.

A pass/fail checker:

> when green flag clicked
> ask [What was your mark?] and wait
> if <(answer) > 49> then
>   say [Pass!]
> else
>   say [Try again.]
===
## Variables in Scratch

Go to **Variables** (dark orange) and click **Make a Variable**. Name it **score** and choose *For all sprites*. Three new blocks appear: *set score to 0*, *change score by 1*, and a round *score* reporter. Tick the box beside the reporter and the score shows on the stage.

Rules in practice:

- Put *set score to 0* right after *when green flag clicked*, so every game starts fresh.
- Use *change score by 1* when something good happens.
- Use the *score* reporter inside a condition: *if <score = 10> then say [You win!]*.

Counting clicks on the cat:

> when green flag clicked
> set score to 0
>
> when this sprite clicked
> change score by 1
> play sound Meow

Two separate scripts, both in the cat. The first resets; the second counts. Scratch runs them at the same time; that is normal, and it is how games work.

### Try this

Add a variable **lives**, set to 3 at the start. Make it go down by 1 when the space key is pressed, and make the cat say "Game over" when lives = 0.
===
## Recap: Scratch basics

- Scratch programs are built from **blocks** snapped into **scripts**, which belong to **sprites** on the **stage**.
- Scripts start with a **hat block** such as *when green flag clicked*.
- **Motion** moves sprites; **Looks** makes them say things and change costume; **Sound** plays sounds; **Pen** draws.
- **Control** holds *repeat*, *forever*, *repeat until* and *if / if-else*.
- Conditions use **Sensing** and **Operators** blocks that give true or false.
- **Variables** store changing values: *set* at the start, *change* during the program, and show with the reporter.
- *repeats × turn angle = 360* for any closed shape.

### Quick quiz

1. Which block starts most scripts?
2. What is the difference between *repeat 10* and *repeat until*?
3. Why must *if <key pressed?>* usually sit inside a *forever* loop?
4. What block would you use at the start of a game to reset the score?
===
## Project: Catch the Mango, part 1

@image https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Students_using_a_computer_laptop.jpg/960px-Students_using_a_computer_laptop.jpg | Pupils building a project together: one keyboard, two minds | Kwameghana (Bright Kwame Ayisi) · CC0 | https://commons.wikimedia.org/wiki/File:Students_using_a_computer_laptop.jpg

We will build the game we decomposed earlier. Start a new project.

**Step 1: the cat moves.**

In the Cat sprite:

> when green flag clicked
> go to x: 0 y: -140
> forever
>   if <key [right arrow] pressed?> then
>     change x by 10
>   if <key [left arrow] pressed?> then
>     change x by -10

Test it. The cat should sit near the bottom and slide left and right. If it drifts off the edge, add *if on edge, bounce* or a condition to stop at x = 220.

**Step 2: a mango appears.**

Click **Choose a Sprite** (bottom right) and search for a fruit; if there is no mango, pick an apple or an orange and rename it **Mango**. Or draw your own in the Paint editor.

In the Mango sprite, make it fall:

> when green flag clicked
> forever
>   go to x: (pick random -220 to 220) y: 170
>   repeat until <(y position) < -170>
>     change y by -5

Test. The mango should fall from a random spot, then reappear at the top.
===
## Project: Catch the Mango, part 2

**Step 3: catching scores a point.**

Make a variable **score**, for all sprites. In the Mango sprite, change the falling loop so that touching the cat ends the fall early:

> when green flag clicked
> set score to 0
> forever
>   go to x: (pick random -220 to 220) y: 170
>   repeat until <<(y position) < -170> or <touching [Cat]?>>
>     change y by -5
>   if <touching [Cat]?> then
>     change score by 1
>     play sound Pop

Test. Each catch adds one; a miss adds nothing. If the score jumps by two on one catch, the mango is still touching the cat when the next fall starts; the *go to* at the top of the loop fixes that.

**Step 4: a timer.**

In the Stage (click it, bottom right) add:

> when green flag clicked
> reset timer
> wait until <(timer) > 60>
> stop [all]

Now the game ends after a minute. You have a working game, built from sequence, loops, conditions and variables. Save it.
===
## Testing and debugging

A program that runs is not necessarily a program that works. **Testing** means trying it on purpose to find mistakes. Use a table:

| Test | What I expect | What happened | Fixed? |
|---|---|---|---|
| Press right arrow | cat moves right | moves right | ✓ |
| Hold right arrow | cat stops at edge | cat disappears | add edge check |
| Miss a mango | score unchanged | score unchanged | ✓ |
| Catch a mango | score +1 | score +2 | move *go to* to loop start |
| Wait 60 s | game stops | stops | ✓ |

Common Scratch bugs and their fixes:

- **Nothing happens** – is there a hat block? Did you click the flag?
- **Happens once, then stops** – the *if* is not inside a *forever*.
- **Sprite vanishes** – it moved off stage; add a *go to* at the start.
- **Too fast to see** – add *wait 0.1* in the loop.
- **Score keeps old value** – no *set score to 0* at the start.
- **Loop never ends** – the *until* condition can never be true.

Fix **one thing at a time**, then test again. Changing three things at once hides which one worked.
===
## Making it better

@image https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/A_boy_using_a_laptop.jpg/960px-A_boy_using_a_laptop.jpg | Improving a program, one small change at a time | Kwameghana (Bright Kwame Ayisi) · CC0 | https://commons.wikimedia.org/wiki/File:A_boy_using_a_laptop.jpg

A working game is a starting point. Each improvement is a small algorithm problem.

**Harder over time** – make a variable **speed**, set to 5 at the start; use *change y by (0 − speed)*; every 10 points, *change speed by 1*.

**Rotten mangoes** – duplicate the Mango sprite, give it a brown costume, and make touching it *change score by -2*.

**Sounds and looks** – a cheer when score reaches 10; the cat changes costume on each catch.

**A start screen** – a sprite that says "Press space to start" and *wait until <key space pressed?>* before broadcasting *start*.

**Broadcast** – in Events, *broadcast [game over]* lets one sprite tell all the others something has happened; *when I receive [game over]* in each sprite responds.

Choose one, plan it in words, build it, test it. That cycle (**plan → build → test → improve**) is how every piece of software you use was made.

### Try this

Plan one improvement as a numbered algorithm before you touch a block. Then build it. Was your plan complete?
===
## Recap: the project

- **Decompose**: cat moves; mango falls; catching scores; timer ends the game.
- **Cat**: *forever* with two *if <key pressed?>* blocks changing x.
- **Mango**: *forever* → *go to* random top → *repeat until <at bottom or touching Cat>* → *change y by -5* → *if touching Cat, change score by 1*.
- **Stage**: *reset timer*, *wait until timer > 60*, *stop all*.
- **Test** with a table of expected and actual results; fix one bug at a time.
- **Improve** with speed, obstacles, sounds, a start screen and broadcasts.

### Quick quiz

1. Why is *set score to 0* placed before the *forever* loop and not inside it?
2. What does *pick random -220 to 220* do, and why those numbers?
3. Explain the condition *<(y position) < -170> or <touching [Cat]?>* in words.
4. What would happen if the Stage script said *wait until <(timer) > 60>* but had no *stop all*?
===
## Algorithms in the real world

The ideas in this book run the world around you.

**Mobile money.** When Ama sends GH₵20 by MoMo: *if <PIN correct> and <balance ≥ 20 + fee> then subtract from Ama, add to receiver, send two SMS; else show an error.* Sequence, condition, variables.

**Traffic lights** at Kwame Nkrumah Circle: a *forever* loop stepping through green, amber, red with *wait* blocks, and sensors (conditions) that lengthen the green when traffic is heavy.

**Search engines** follow algorithms to decide which pages to show first.

**Phone cameras** run algorithms to sharpen faces and brighten dark rooms.

**Weather forecasts** for the farming season come from algorithms running on huge computers.

**Social media** uses algorithms to decide what you see next, which is why it is worth understanding them: an algorithm has goals, and they are the goals of whoever wrote it, not necessarily yours.

### Try this

Write, as a flowchart, the algorithm an ATM follows from "card inserted" to "cash dispensed". Include at least two decisions.
===
## Searching: a classic algorithm

Suppose a class register of 40 names is in alphabetical order and you want to find "Mensah".

**Linear search:** start at the top; check each name in turn until you find it. Simple, always works, but might take 40 checks.

**Binary search:** open the register in the **middle**. Is "Mensah" before or after the middle name? Throw away the half it cannot be in. Open the middle of the remaining half. Repeat.

> 40 names → 20 → 10 → 5 → 3 → 2 → 1

Found in about six checks instead of up to forty. With a million names, binary search needs only about twenty checks. This is how a dictionary, a phone contact list and a database find things quickly.

The catch: binary search only works on a list that is **already sorted**. Linear search works on anything.

Two algorithms, same problem, very different speed. Choosing a good algorithm matters more than having a fast computer.

### Try this

Play a guessing game: a friend thinks of a number from 1 to 100, and you may ask "higher or lower?" Use binary search. How many guesses did you need?
===
## Sorting: putting things in order

@image https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Pupils_doing_online_tests.jpg/960px-Pupils_doing_online_tests.jpg | Pupils working through steps on screen: computers follow algorithms exactly | Advancedsolver · CC BY-SA 4.0 | https://commons.wikimedia.org/wiki/File:Pupils_doing_online_tests.jpg

Sorting is so common that dozens of algorithms exist for it. Here is **bubble sort**, the simplest to understand.

Line up these test marks: **45, 12, 78, 33**.

Pass 1: compare neighbours, swap if out of order.
- 45, 12 → swap → 12, 45, 78, 33
- 45, 78 → fine
- 78, 33 → swap → 12, 45, 33, 78

Pass 2:
- 12, 45 → fine
- 45, 33 → swap → 12, 33, 45, 78
- 45, 78 → fine

Pass 3: no swaps. **Sorted.**

The big values "bubble" to the end, one pass at a time. As a flowchart it is a loop (passes) containing a loop (comparisons) containing a condition (swap?). It is slow for long lists; computers usually use cleverer sorts, but all of them are built from the same three patterns.

### Try this

Sort **9, 3, 7, 1, 5** with bubble sort on paper. How many passes? How many swaps?
===
## Pseudocode: writing it in plain words

Between a flowchart and a real program sits **pseudocode**: an algorithm written in structured English that anyone can read, without worrying about the exact rules of a language.

The mango game's mango, in pseudocode:

> SET score TO 0
> REPEAT FOREVER
>   MOVE mango TO random x, top of stage
>   REPEAT UNTIL mango at bottom OR mango touching cat
>     MOVE mango down 5
>   END REPEAT
>   IF mango touching cat THEN
>     ADD 1 TO score
>   END IF
> END REPEAT

Conventions:

- **Keywords** in capitals: SET, IF, THEN, ELSE, REPEAT, UNTIL, WHILE, OUTPUT, INPUT.
- **Indent** what is inside a loop or an IF.
- Close each block with END.

Pseudocode is used in exams and in real software teams to agree *what* a program does before arguing about *how*. If you can write good pseudocode, you can learn any programming language, because they all have the same bones.

### Try this

Write pseudocode for the trotro mate's fare algorithm from earlier.
===
## Being safe and fair online

Scratch has an online community where millions of young people share projects, and you may want to join it. The same rules apply there as everywhere online.

- **Your username** should not be your real full name, and your profile should not say your school, town or phone number.
- **Be kind.** Scratch's community guidelines ask you to be respectful, constructive and honest. Comment on projects the way you would want others to comment on yours.
- **Remixing** is allowed and encouraged in Scratch, but give credit: the remix note should say whose project you started from.
- **Never share your password**, even with a friend.
- If someone makes you uncomfortable, **tell a trusted adult** and use the Report button.

Algorithms also raise fairness questions. If a program decides who gets a loan or which news people see, and the rules inside it are unfair, the unfairness happens at machine speed. People who understand algorithms can ask: *What is this program actually told to do? Who wrote the rules?* You are now one of those people.
===
## Test yourself

**Section A**

1. Define *algorithm* and give one example from daily life that is not about computers.
2. Name the flowchart shape for (a) a decision, (b) input/output, (c) start and stop.
3. What is the difference between a count-controlled and a condition-controlled loop? Give a Scratch block for each.
4. Explain what a variable is and why it must be given a starting value.
5. What does *if … then … else* do?

**Section B**

6. Draw a flowchart that asks for a temperature and outputs "Hot" if it is above 30, "Warm" if it is 20 to 30, and "Cool" otherwise.
7. A pupil's Scratch cat moves when the arrow key is pressed once, then never again. What is the likely bug, and how would you fix it?
8. Write pseudocode to add up the marks of 30 pupils and output the average.
9. Explain why binary search is faster than linear search, and what it requires.
10. Describe one way an algorithm affects your life, and one question you could ask about it.
===
## Test answers

1. A precise, ordered, finite, effective set of steps to solve a problem. Example: a recipe, directions, the steps for washing hands.
2. (a) Diamond, (b) parallelogram, (c) oval/rounded box.
3. Count-controlled repeats a fixed number of times (*repeat 10*); condition-controlled repeats until or while something is true (*repeat until <  >*).
4. A named store for a value that can change. Without a starting value it may hold an old or random value, giving wrong results.
5. Checks a condition; runs the first group of blocks if true, the second group if false.
6. Start → Input temperature → Is temp > 30? Yes → Output "Hot" → Stop; No → Is temp ≥ 20? Yes → Output "Warm" → Stop; No → Output "Cool" → Stop.
7. The *if <key pressed?>* is not inside a *forever* loop, so it is checked once. Wrap it in *forever*.
8. SET total TO 0; REPEAT 30 TIMES: INPUT mark; ADD mark TO total; END REPEAT; SET average TO total ÷ 30; OUTPUT average.
9. Binary search halves the list at each step, so it needs about log₂(n) checks instead of up to n; it requires the list to be sorted.
10. For example: MoMo checks PIN and balance before sending; question: what happens to my data, and who decides the fees?
===
## Glossary

**Algorithm** — a clear, ordered, finite set of steps that solves a problem.

**Sequence** — steps carried out one after another in order.

**Selection** — choosing between paths using a condition (if … then … else).

**Iteration / loop** — repeating steps; count-controlled or condition-controlled.

**Condition** — a question with a true/false answer.

**Boolean** — a value that is either true or false.

**Variable** — a named store for a value that can change.

**Flowchart** — a diagram of an algorithm using standard shapes and arrows.

**Pseudocode** — an algorithm written in structured plain English.

**Decomposition** — breaking a big problem into smaller ones.

**Debugging** — finding and fixing mistakes.

**Sprite** — a character or object in Scratch with its own scripts.

**Stage** — the area where a Scratch program runs.

**Script** — a stack of Scratch blocks beginning with a hat block.

**Broadcast** — a message one sprite sends so that others can respond.

**Infinite loop** — a loop whose stopping condition can never become true.
===
## Learn more

- [Scratch](https://scratch.mit.edu/) — create, save and share projects for free; no installation needed.
- [Scratch: Getting Started tutorial](https://scratch.mit.edu/projects/editor/?tutorial=getStarted) — opens the editor with a step-by-step guide beside it.
- [Scratch Ideas](https://scratch.mit.edu/ideas) — tutorials and activity cards for animations, games and stories.
- [Raspberry Pi Foundation: Catch the Bus](https://projects.raspberrypi.org/en/projects/catch-the-bus) — a free step-by-step Scratch game project.
- [Code.org](https://code.org/) — Hour of Code puzzles that teach sequence, loops and conditions.
===
## Watch more
@video ssoRNCtmhVM | Getting Started with Scratch | Scratch Team
@video 6hfOvs8pY1k | What's an algorithm? - David J. Malan | TED-Ed
@video 11gESTba3eU | Scratch 4: loops and conditionals | TwinsTeachTech
@video ZnBF2GeAKbo | What exactly is an algorithm? Algorithms explained | BBC Ideas | BBC Ideas
===
## Think about it

1. A recipe says "season to taste". Why is this a problem for a computer but not for a cook? How would you make it precise?
2. Where in your school day do you follow a loop? Where do you make a selection?
3. Scratch lets you see your program as blocks. Why might that make learning easier than typing text? What might it make harder later?
4. If two people write different algorithms for the same task and both work, how would you decide which is better?
5. An app's algorithm decides what you see next. Whose goals is it serving? How could you tell?
