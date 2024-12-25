import gsap, { Power0 } from "gsap";
import { Container, Sprite } from "pixi.js";
import { GAME_HEIGHT, GAME_WIDTH } from ".";
import * as PIXI from "pixi.js";
import { sound } from "@pixi/sound";
import { supabase } from "./supabaseClient";

export default class Game extends Container {
  constructor() {
    super();

    this.setupBackground();
    this.setupSounds();

    // Oyun başlangıçta başlamamalı
    this.isGameRunning = false;

    // Start butonunu oluştur
    this.createStartButton();
  }

  createStartButton() {
    // Start butonu container'ı oluştur
    this.startButton = new PIXI.Container();

    // Buton arkaplanı
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x4caf50);
    buttonBg.drawRoundedRect(0, 0, 200, 60, 10);
    buttonBg.endFill();
    this.startButton.addChild(buttonBg);

    // Buton metni
    const buttonText = new PIXI.Text("Start Game", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
    });
    buttonText.anchor.set(0.5);
    buttonText.x = buttonBg.width / 2;
    buttonText.y = buttonBg.height / 2;
    this.startButton.addChild(buttonText);

    // Butonu ortala
    this.startButton.x = GAME_WIDTH / 2 - this.startButton.width / 2;
    this.startButton.y = GAME_HEIGHT / 2 - this.startButton.height / 2;

    // Butonu interaktif yap
    this.startButton.eventMode = "static";
    this.startButton.cursor = "pointer";

    // Hover efektleri
    this.startButton.on("pointerover", () => {
      buttonBg.tint = 0x45a049;
      this.startButton.scale.set(1.05);
    });

    this.startButton.on("pointerout", () => {
      buttonBg.tint = 0xffffff;
      this.startButton.scale.set(1);
    });

    // Tıklama olayı
    this.startButton.on("pointerdown", () => {
      this.startGame();
    });

    this.addChild(this.startButton);
  }

  startGame() {
    // Start butonunu kaldır
    if (this.startButton) {
      this.removeChild(this.startButton);
      this.startButton = null;
    }

    this.isGameRunning = true;
    this.init();
  }

  setupBackground() {
    // Create background sprite
    const background = Sprite.from("space");

    // Scale background to fill game dimensions
    background.width = GAME_WIDTH;
    background.height = GAME_HEIGHT;

    // Add background as first child (so it's behind everything)
    this.addChild(background);
  }

  setupSounds() {
    // Start background music loop
    sound.play("background", {
      loop: true,
      volume: 0.5,
    });
  }

  setupControls() {
    // Mevcut keyboard event listener'ı kaldır
    if (this.keydownListener) {
      window.removeEventListener("keydown", this.keydownListener);
    }

    // Yeni listener oluştur
    this.keydownListener = (e) => {
      if (this.gameOver) return; // Oyun bittiyse kontrolleri devre dışı bırak

      if (e.key === "ArrowLeft") {
        this.player.x = Math.max(this.player.x - 10, 0);
      }
      if (e.key === "ArrowRight") {
        this.player.x = Math.min(this.player.x + 10, GAME_WIDTH);
      }
      if (e.key === " ") {
        this.shoot();
      }
    };

    window.addEventListener("keydown", this.keydownListener);
  }

  init() {
    // Add stage and score tracking
    this.stage = 1;
    this.score = 0;

    // Create score/stage text in top left
    this.scoreText = new PIXI.Text("Stage: 1 | Score: 0", {
      fontFamily: "Arial",
      fontSize: 20,
      fill: 0xffffff,
      align: "left",
    });
    this.scoreText.x = 20;
    this.scoreText.y = 20;
    this.addChild(this.scoreText);

    // Initialize first stage
    this.createEnemies();

    // Create player ship
    this.player = Sprite.from("spaceship");
    this.player.anchor.set(0.5);
    // Adjust player scale to fit game width (assuming ship should take ~10% of game width)
    const playerDesiredWidth = GAME_WIDTH * 0.1;
    this.player.scale.set(playerDesiredWidth / this.player.width);
    this.player.x = GAME_WIDTH * 0.5;
    this.player.y = GAME_HEIGHT - GAME_HEIGHT * 0.1; // Position 10% from bottom
    this.addChild(this.player);

    // Create bullets container with green bullets
    this.bullets = new Container();
    this.addChild(this.bullets);
    this.bulletSpeed = 7;
    this.bulletSize = 8;

    // Initialize timer with shorter duration
    this.timeLeft = 15;
    this.startTime = Date.now();

    // Enemy movement - adjust timing to reach bottom 1 second before timer
    gsap.to(this.enemies, {
      pixi: {
        x: 100,
        y: "+=400",
      },
      duration: 14, // 14 seconds to reach bottom (1 second before 15s timer)
      repeat: -1,
      yoyo: true,
      ease: Power0.easeNone,
    });

    // Add game state
    this.gameOver = false;

    // Keyboard kontrollerini kur
    this.setupControls();

    // Start game loop
    this.ticker = gsap.ticker.add(() => this.update());

    // Create timer container in top right
    this.timerContainer = new Container();
    this.addChild(this.timerContainer);

    // Position in top right with padding
    this.timerContainer.x = GAME_WIDTH - 60;
    this.timerContainer.y = 60;

    // Create circular background
    this.timerCircle = new PIXI.Graphics();
    this.timerContainer.addChild(this.timerCircle);

    // Create timer text
    this.timerText = new PIXI.Text("15", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
    });
    this.timerText.anchor.set(0.5);
    this.timerContainer.addChild(this.timerText);
  }

  checkCollision(bullet, enemy) {
    const bounds1 = bullet.getBounds();
    const bounds2 = enemy.getBounds();

    return (
      bounds1.x < bounds2.x + bounds2.width &&
      bounds1.x + bounds1.width > bounds2.x &&
      bounds1.y < bounds2.y + bounds2.height &&
      bounds1.y + bounds1.height > bounds2.y
    );
  }

  checkGameOver() {
    // Check if any enemy has reached the player's vertical position
    for (const enemy of this.enemies.children) {
      if (
        enemy.y + enemy.height / 2 >=
        this.player.y - this.player.height / 2
      ) {
        return true;
      }
    }
    return false;
  }

  showGameOver() {
    this.gameOver = true;
    gsap.ticker.remove(this.ticker);

    // Game Over container
    const gameOverContainer = new PIXI.Container();

    // Ana kutu arka planı
    const boxBg = new PIXI.Graphics();
    boxBg.beginFill(0x000000, 0.9);
    boxBg.drawRoundedRect(0, 0, 400, 500, 15);
    boxBg.endFill();
    boxBg.x = GAME_WIDTH / 2 - 200;
    boxBg.y = GAME_HEIGHT / 2 - 250;
    gameOverContainer.addChild(boxBg);

    // Game Over text
    const gameOverText = new PIXI.Text("GAME OVER", {
      fontFamily: "Arial",
      fontSize: 48,
      fill: 0xff0000,
      align: "center",
    });
    gameOverText.anchor.set(0.5);
    gameOverText.x = GAME_WIDTH / 2;
    gameOverText.y = boxBg.y + 50;
    gameOverContainer.addChild(gameOverText);

    // Score text
    const scoreText = new PIXI.Text(
      `Final Score: ${this.score}\nStage: ${this.stage}`,
      {
        fontFamily: "Arial",
        fontSize: 24,
        fill: 0xffffff,
        align: "center",
      }
    );
    scoreText.anchor.set(0.5);
    scoreText.x = GAME_WIDTH / 2;
    scoreText.y = gameOverText.y + 80;
    gameOverContainer.addChild(scoreText);

    // Nickname input container
    const inputContainer = new PIXI.Container();
    inputContainer.x = GAME_WIDTH / 2 - 100;
    inputContainer.y = scoreText.y + 60;

    // Input label
    const inputLabel = new PIXI.Text("Enter Your Nickname:", {
      fontFamily: "Arial",
      fontSize: 18,
      fill: 0xffffff,
    });
    inputContainer.addChild(inputLabel);

    // Input background
    const inputBg = new PIXI.Graphics();
    inputBg.beginFill(0x333333);
    inputBg.drawRoundedRect(0, 30, 200, 40, 5);
    inputBg.endFill();
    inputContainer.addChild(inputBg);

    gameOverContainer.addChild(inputContainer);

    // HTML input element
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Nickname";
    input.style.position = "absolute";
    input.style.left = `${inputContainer.x + 5}px`;
    input.style.top = `${inputContainer.y + 35}px`;
    input.style.width = "190px";
    input.style.height = "30px";
    input.style.fontSize = "16px";
    input.style.borderRadius = "5px";
    input.style.border = "none";
    input.style.padding = "0 5px";
    document.body.appendChild(input);

    // Save Score button
    const saveButton = new PIXI.Container();
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x4caf50);
    buttonBg.drawRoundedRect(0, 0, 150, 50, 10);
    buttonBg.endFill();
    saveButton.addChild(buttonBg);

    const buttonText = new PIXI.Text("Save Score", {
      fontFamily: "Arial",
      fontSize: 20,
      fill: 0xffffff,
    });
    buttonText.anchor.set(0.5);
    buttonText.x = 75;
    buttonText.y = 25;
    saveButton.addChild(buttonText);

    saveButton.x = GAME_WIDTH / 2 - 75;
    saveButton.y = inputContainer.y + 100;
    saveButton.eventMode = "static";
    saveButton.cursor = "pointer";

    let scoreSaved = false;

    saveButton.on("pointerdown", async () => {
      const nickname = input.value.trim();
      if (nickname && !scoreSaved) {
        scoreSaved = true;
        document.body.removeChild(input);

        // Save butonunu devre dışı bırak
        saveButton.eventMode = "none";
        saveButton.cursor = "default";
        buttonBg.tint = 0x666666; // Gri renk ile devre dışı olduğunu göster

        await this.saveScore(nickname);
        gameOverContainer.removeChild(saveButton);
      }
    });

    gameOverContainer.addChild(saveButton);

    // Try Again button
    const tryAgainButton = new PIXI.Container();
    const tryAgainBg = new PIXI.Graphics();
    tryAgainBg.beginFill(0x2196f3);
    tryAgainBg.drawRoundedRect(0, 0, 150, 50, 10);
    tryAgainBg.endFill();
    tryAgainButton.addChild(tryAgainBg);

    const tryAgainText = new PIXI.Text("Try Again", {
      fontFamily: "Arial",
      fontSize: 20,
      fill: 0xffffff,
    });
    tryAgainText.anchor.set(0.5);
    tryAgainText.x = 75;
    tryAgainText.y = 25;
    tryAgainButton.addChild(tryAgainText);

    // Try Again butonunu kutunun altına yasla
    tryAgainButton.x = GAME_WIDTH / 2 - 75;
    tryAgainButton.y = boxBg.y + boxBg.height - 70; // Kutunun altından 70px yukarıda
    tryAgainButton.eventMode = "static";
    tryAgainButton.cursor = "pointer";

    tryAgainButton.on("pointerdown", () => {
      const inputElement = document.querySelector("input");
      if (inputElement) {
        inputElement.remove();
      }
      this.resetGame();
    });

    gameOverContainer.addChild(tryAgainButton);
    this.addChild(gameOverContainer);
  }

  updateTimer() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.timeLeft = Math.max(
      (this.stage === 1 ? 15 : Math.max(14 - (this.stage - 2), 5) + 1) -
        elapsed,
      0
    );

    // Update timer text
    this.timerText.text = Math.ceil(this.timeLeft);

    // Draw timer circle
    this.timerCircle.clear();

    // Background circle
    this.timerCircle.lineStyle(3, 0x333333);
    this.timerCircle.beginFill(0x000000, 0.5);
    this.timerCircle.drawCircle(0, 0, 30);
    this.timerCircle.endFill();

    // Progress arc
    const maxTime =
      this.stage === 1 ? 15 : Math.max(14 - (this.stage - 2), 5) + 1;
    const progress = this.timeLeft / maxTime;
    if (progress > 0) {
      const color = progress < 0.3 ? 0xff0000 : 0x00ff00; // Red when < 30% time left
      this.timerCircle.lineStyle(3, color);
      this.timerCircle.arc(
        0,
        0, // center
        30, // radius
        -Math.PI / 2, // start angle
        -Math.PI / 2 + Math.PI * 2 * progress // end angle
      );
    }

    // Check for time out
    if (this.timeLeft === 0 && !this.gameOver) {
      this.showGameOver();
    }
  }

  update() {
    // Oyun başlamadıysa güncelleme yapma
    if (!this.isGameRunning) return;

    if (this.gameOver) return;

    this.updateTimer();

    // Check for game over conditions
    if (this.checkGameOver() || this.timeLeft === 0) {
      this.showGameOver();
      return;
    }

    // Update bullets and check collisions
    for (let i = this.bullets.children.length - 1; i >= 0; i--) {
      const bullet = this.bullets.children[i];
      bullet.y -= this.bulletSpeed;

      // Check collision with only one enemy per bullet
      for (let j = this.enemies.children.length - 1; j >= 0; j--) {
        const enemy = this.enemies.children[j];
        if (this.checkCollision(bullet, enemy)) {
          sound.play("explosion", { volume: 0.4 });
          this.bullets.removeChild(bullet);
          this.enemies.removeChild(enemy);
          this.score += 100;
          this.updateScoreText();

          if (this.enemies.children.length === 0) {
            this.nextStage();
          }
          break; // Exit after first collision
        }
      }

      if (bullet.y < -this.bulletSize) {
        this.bullets.removeChild(bullet);
      }
    }
  }

  shoot() {
    if (this.gameOver) return; // Oyun bittiyse ateş etmeyi engelle

    const bullet = new PIXI.Graphics();
    bullet.beginFill(0x00ff00);
    bullet.drawRect(
      -this.bulletSize / 2,
      -this.bulletSize / 2,
      this.bulletSize,
      this.bulletSize
    );
    bullet.endFill();

    // Position bullet at player's position
    bullet.x = this.player.x;
    bullet.y = this.player.y - this.player.height / 2;

    this.bullets.addChild(bullet);

    sound.play("shoot", { volume: 0.3 });
  }

  showVictory() {
    this.gameOver = true;
    gsap.ticker.remove(this.ticker);

    const victoryText = new PIXI.Text("VICTORY!", {
      fontFamily: "Arial",
      fontSize: 48,
      fill: 0x00ff00,
      align: "center",
    });

    victoryText.anchor.set(0.5);
    victoryText.x = GAME_WIDTH / 2;
    victoryText.y = GAME_HEIGHT / 2 - 50;
    this.addChild(victoryText);

    // Add final score
    const scoreText = new PIXI.Text(`Final Score: ${this.score}`, {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0x00ff00,
      align: "center",
    });
    scoreText.anchor.set(0.5);
    scoreText.x = GAME_WIDTH / 2;
    scoreText.y = GAME_HEIGHT / 2;
    this.addChild(scoreText);

    // Add Try Again button
    const button = new PIXI.Container();

    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0x4caf50);
    buttonBg.drawRoundedRect(0, 0, 150, 50, 10);
    buttonBg.endFill();
    button.addChild(buttonBg);

    const buttonText = new PIXI.Text("Play Again", {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffffff,
      align: "center",
    });
    buttonText.anchor.set(0.5);
    buttonText.x = buttonBg.width / 2;
    buttonText.y = buttonBg.height / 2;
    button.addChild(buttonText);

    button.x = GAME_WIDTH / 2 - button.width / 2;
    button.y = GAME_HEIGHT / 2 + 50;

    button.eventMode = "static";
    button.cursor = "pointer";

    button.on("pointerover", () => {
      buttonBg.tint = 0x45a049;
      button.scale.set(1.05);
    });

    button.on("pointerout", () => {
      buttonBg.tint = 0xffffff;
      button.scale.set(1);
    });

    button.on("pointerdown", () => this.resetGame());

    this.addChild(button);

    // Stop enemy movement
    gsap.killTweensOf(this.enemies);

    sound.stop("background");
    sound.play("victory");
  }

  createEnemies() {
    // Clear existing enemies if any
    if (this.enemies) {
      this.removeChild(this.enemies);
    }

    // Show victory if stage 11 is reached
    if (this.stage === 11) {
      this.showVictory();
      return;
    }

    this.enemies = new Container();
    this.addChild(this.enemies);

    // Different formations based on stage
    const formations = {
      1: { rows: 3, cols: 4, pattern: "grid" },
      2: { rows: 4, cols: 5, pattern: "v" },
      3: { rows: 3, cols: 8, pattern: "triangle" },
      4: { rows: 4, cols: 8, pattern: "diamond" },
      5: { rows: 5, cols: 7, pattern: "x" },
      6: { rows: 4, cols: 10, pattern: "zigzag" },
      7: { rows: 5, cols: 9, pattern: "circle" },
      8: { rows: 6, cols: 8, pattern: "cross" },
    };

    // Use current stage or cycle back to start
    const currentFormation = formations[((this.stage - 1) % 8) + 1];
    const { rows, cols, pattern } = currentFormation;

    // Calculate enemy spacing with dynamic adjustment for larger formations
    const maxEnemies = Math.max(rows * cols * 0.7, 15); // At least 15 enemies
    const enemySpacing = GAME_WIDTH * (0.1 - this.stage * 0.005); // Reduce spacing as stage increases
    const startX = (GAME_WIDTH - (cols - 1) * enemySpacing) / 2;
    const startY = GAME_HEIGHT * 0.1;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Skip positions based on pattern
        if (!this.shouldCreateEnemy(row, col, pattern, rows, cols)) continue;

        const enemy = Sprite.from("monster");
        enemy.anchor.set(0.5);
        const enemyDesiredWidth = enemySpacing * 0.7;
        enemy.scale.set(enemyDesiredWidth / enemy.width);

        // Position based on pattern
        let x = startX + col * enemySpacing;
        let y = startY + row * enemySpacing;

        // Adjust position based on pattern
        if (pattern === "v") {
          x += (Math.abs(row - rows / 2) * enemySpacing) / 2;
        } else if (pattern === "triangle") {
          x += (Math.abs(row) * enemySpacing) / 2;
        } else if (pattern === "diamond") {
          x += (Math.abs(row - rows / 2) * enemySpacing) / 2;
        }

        enemy.x = x;
        enemy.y = y;
        this.enemies.addChild(enemy);
      }
    }

    // Calculate duration based on stage (14 seconds initially, -1 second per stage)
    const duration = Math.max(14 - (this.stage - 1), 5); // Minimum 5 seconds

    // Update timer duration to match enemy movement (plus 1 second buffer)
    this.timeLeft = duration + 1;
    this.startTime = Date.now();

    gsap.to(this.enemies, {
      pixi: {
        x: 100,
        y: "+=400",
      },
      duration: duration,
      repeat: -1,
      yoyo: true,
      ease: Power0.easeNone,
    });
  }

  shouldCreateEnemy(row, col, pattern, rows, cols) {
    const midRow = Math.floor(rows / 2);
    const midCol = Math.floor(cols / 2);

    switch (pattern) {
      case "grid":
        return true;
      case "v":
        return col >= Math.abs(row - rows / 2);
      case "triangle":
        return col >= row && col < cols - row;
      case "diamond":
        return (
          col >= Math.abs(row - midRow) && col < cols - Math.abs(row - midRow)
        );
      case "x":
        return (
          Math.abs(row - midRow) === Math.abs(col - midCol) ||
          Math.abs(row - midRow) === Math.abs(col - (cols - midCol - 1))
        );
      case "zigzag":
        return (
          (row % 2 === 0 && col % 2 === 0) || (row % 2 === 1 && col % 2 === 1)
        );
      case "circle":
        const distance = Math.sqrt(
          Math.pow(row - midRow, 2) + Math.pow(col - midCol, 2)
        );
        return distance <= Math.min(rows, cols) / 2;
      case "cross":
        return row === midRow || col === midCol;
      default:
        return true;
    }
  }

  nextStage() {
    sound.play("levelUp");
    this.stage++;
    this.score += 1000; // Stage completion bonus
    this.updateScoreText();

    // Timer will be reset in createEnemies
    this.createEnemies();
  }

  updateScoreText() {
    this.scoreText.text = `Stage: ${this.stage} | Score: ${this.score}`;
  }

  resetGame() {
    // Input elementini kontrol et ve temizle
    const inputElement = document.querySelector("input");
    if (inputElement) {
      inputElement.remove();
    }

    // Remove all existing children
    this.removeChildren();

    // Reset game state
    this.gameOver = false;
    this.isGameRunning = false;
    this.stage = 1;
    this.score = 0;

    // Önce arka planı yeniden oluştur
    this.setupBackground();

    // Start butonunu tekrar oluştur
    this.createStartButton();

    sound.stop("background");
    this.setupSounds();
  }

  async saveScore(nickname) {
    try {
      const { data, error } = await supabase
        .from("highscores")
        .insert([{ nickname: nickname, score: this.score, stage: this.stage }]);

      if (error) throw error;

      // Skor kaydedildikten sonra high scores'u göster
      await this.showHighScores();
    } catch (error) {
      console.error("Error saving score:", error);
    }
  }

  async showHighScores() {
    try {
      const { data: highscores, error } = await supabase
        .from("highscores")
        .select("*")
        .order("score", { ascending: false })
        .limit(7); // En iyi 7 skoru getir

      if (error) throw error;

      // Mevcut skor tablosunu temizle
      if (this.scoreTable) {
        this.removeChild(this.scoreTable);
      }

      // Yeni skor tablosu container'ı
      this.scoreTable = new PIXI.Container();

      // Skor tablosu arka planı - yüksekliği azalt
      const tableBg = new PIXI.Graphics();
      tableBg.beginFill(0x000000, 0.9);
      tableBg.drawRoundedRect(0, 0, 300, 300, 15); // Yüksekliği azalt
      tableBg.endFill();
      tableBg.x = GAME_WIDTH / 2 - 150;
      tableBg.y = GAME_HEIGHT / 2 - 150; // Pozisyonu ayarla
      this.scoreTable.addChild(tableBg);

      // Başlık
      const titleText = new PIXI.Text("HIGH SCORES", {
        fontFamily: "Arial",
        fontSize: 28,
        fill: 0xffd700,
        align: "center",
      });
      titleText.anchor.set(0.5);
      titleText.x = GAME_WIDTH / 2;
      titleText.y = tableBg.y + 30;
      this.scoreTable.addChild(titleText);

      // Skorları listele
      highscores.forEach((score, index) => {
        const scoreText = new PIXI.Text(
          `${index + 1}. ${score.nickname} - ${score.score}`,
          {
            fontFamily: "Arial",
            fontSize: 18,
            fill: 0xffffff,
            align: "left",
          }
        );
        scoreText.x = tableBg.x + 30;
        scoreText.y = titleText.y + 50 + index * 25;
        this.scoreTable.addChild(scoreText);
      });

      this.addChild(this.scoreTable);
    } catch (error) {
      console.error("Error fetching high scores:", error);
    }
  }
}
