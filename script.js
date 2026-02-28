window.onload = function() {
    const canvas = document.querySelector("canvas");
    const c = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const mouse = { x: canvas.width / 2, y: canvas.height - 50 };
    canvas.addEventListener("mousemove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    canvas.addEventListener("touchmove", e => {
        e.preventDefault();
        const touch = e.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
    }, { passive: false });

    // -------------------------
    // Sounds
    // -------------------------
    const shootSound = new Audio("https://www.soundjay.com/mechanical/sounds/laser-01.mp3");
    const enemyHitSound = new Audio("https://www.soundjay.com/button/sounds/button-10.mp3");
    const healthSound = new Audio("https://www.soundjay.com/button/sounds/button-3.mp3");
    const playerHitSound = new Audio("https://www.soundjay.com/button/sounds/button-16.mp3");
    const bgMusic = new Audio("https://www.soundjay.com/nature/sounds/rain-01.mp3");
    [shootSound, enemyHitSound, healthSound, playerHitSound, bgMusic].forEach(s => s.preload = "auto");
    bgMusic.loop = true;
    bgMusic.volume = 0.2;

    // -------------------------
    // Game Variables
    // -------------------------
    let score = 0;
    let health = 100;
    let gameStarted = false;
    let bossShown = false;
    let enemyIntervalId, healthkitIntervalId, fireIntervalId;

    const playerWidth = 64, playerHeight = 64;
    const playerImg = new Image();
    playerImg.src = "spaceship-preview.png";

    const bullets = [];
    const bulletWidth = 6, bulletHeight = 12, bulletSpeed = 12;
    const enemies = [];
    const healthkits = [];
    const healthkitImg = new Image();
    healthkitImg.src = "https://image.ibb.co/gFvSEU/first_aid_kit.png";
    const enemyImages = [
        "william-robinson-gun-alien-firing-animation.gif",
        "octopus-preview.png",
        "matt-smith-enemy.gif"
    ];

    const explosions = [];

    // -------------------------
    // Boss Setup
    // -------------------------
    const bossImg = new Image();
    bossImg.src = "BOSS-_Preview.png"; // Replace with your boss image
    let boss = null;
    const bossBullets = [];

    class Boss {
        constructor(x, y, width, height, img){
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.image = img;
            this.speed = 1;
            this.maxHealth = 50;
            this.health = this.maxHealth;
            this.fireIntervalId = null;
        }
        startFiring(){
            if(this.fireIntervalId) return;
            this.fireIntervalId = setInterval(() => {
                bossBullets.push(new BossBullet(this.x + this.width/2 - 4, this.y + this.height));
            }, 800);
        }
        stopFiring(){
            clearInterval(this.fireIntervalId);
            this.fireIntervalId = null;
        }
        update(){
            this.y += this.speed;
            if(this.y > canvas.height/3) this.speed = 0;
            this.draw();
            this.startFiring();
        }
        draw(){
            c.drawImage(this.image, this.x, this.y, this.width, this.height);
            c.fillStyle = "red";
            c.fillRect(this.x, this.y - 10, this.width*(this.health/this.maxHealth), 5);
            c.strokeStyle = "white";
            c.strokeRect(this.x, this.y - 10, this.width, 5);
        }
    }

    class BossBullet {
        constructor(x,y){ this.x=x; this.y=y; this.width=8; this.height=16; this.speed=6; }
        update(){ this.y += this.speed; this.draw(); }
        draw(){ c.fillStyle="orange"; c.fillRect(this.x,this.y,this.width,this.height); }
    }

    // -------------------------
    // Classes
    // -------------------------
    class Player {
        constructor(x,y,w,h,img){ this.x=x; this.y=y; this.width=w; this.height=h; this.image=img;}
        update(){ this.x = Math.max(0, Math.min(mouse.x-this.width/2, canvas.width-this.width)); this.y=Math.max(0,Math.min(mouse.y-this.height/2, canvas.height-this.height)); this.draw();}
        draw(){ c.drawImage(this.image,this.x,this.y,this.width,this.height);}
    }

    class Bullet{
        constructor(x,y){ this.x=x; this.y=y; this.width=bulletWidth; this.height=bulletHeight; this.trail=[];}
        update(){
            this.y-=bulletSpeed;
            this.trail.push({x:this.x+this.width/2, y:this.y+this.height});
            if(this.trail.length>5) this.trail.shift();
            this.draw();
        }
        draw(){
            c.fillStyle="white";
            c.fillRect(this.x,this.y,this.width,this.height);
            for(let i=0;i<this.trail.length;i++){
                const t = this.trail[i];
                c.fillStyle=`rgba(0,255,255,${0.2 + i*0.15})`;
                c.fillRect(t.x-1,t.y-3,3,6);
            }
        }
    }

    class Enemy{
        constructor(x,y,speed,w,h,img){ this.x=x; this.y=y; this.speed=speed; this.width=w; this.height=h; this.image=img;}
        update(){ this.y+=this.speed; this.draw();}
        draw(){ c.drawImage(this.image,this.x,this.y,this.width,this.height);}
    }

    class Healthkit{
        constructor(x,y,speed){ this.x=x; this.y=y; this.width=32; this.height=32; this.speed=speed;}
        update(){ this.y+=this.speed; this.draw();}
        draw(){ c.drawImage(healthkitImg,this.x,this.y,this.width,this.height);}
    }

    class Explosion{
        constructor(x,y){ this.x=x; this.y=y; this.radius=0; this.max=20; this.alpha=1;}
        update(){ this.radius+=2; this.alpha-=0.08; this.draw();}
        draw(){ c.save(); c.globalAlpha=this.alpha; c.fillStyle="orange"; c.beginPath(); c.arc(this.x,this.y,this.radius,0,Math.PI*2); c.fill(); c.restore();}
        done(){ return this.alpha<=0; }
    }

    const player = new Player(canvas.width/2-playerWidth/2,canvas.height-playerHeight-10,playerWidth,playerHeight,playerImg);

    // -------------------------
    // Helper Functions
    // -------------------------
    function spawnEnemies(){ 
        for(let i=0;i<4;i++){ 
            const x=Math.random()*(canvas.width-32); 
            const speed=1+Math.random()*1; 
            const width=32,height=32; 
            const img=new Image(); 
            img.src=enemyImages[Math.floor(Math.random()*enemyImages.length)]; 
            enemies.push(new Enemy(x,-height,speed,width,height,img)); 
        } 
    }

    function spawnHealthkit(){ 
        const x=Math.random()*(canvas.width-32); 
        const speed=1+Math.random()*2.5; 
        healthkits.push(new Healthkit(x,-32,speed)); 
    }

    function fireBullet(){
        bullets.push(new Bullet(player.x+player.width/2-5,player.y));
        bullets.push(new Bullet(player.x+player.width/2+1,player.y));
        shootSound.play().catch(()=>{});
    }

    function collision(a,b){ return a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y; }

    function restartGame(){
        score=0; health=100; bullets.length=0; enemies.length=0; healthkits.length=0; explosions.length=0; bossBullets.length=0;
        player.x=canvas.width/2-playerWidth/2; player.y=canvas.height-playerHeight-10;
        gameStarted=false; bossShown=false; boss=null;
        clearInterval(enemyIntervalId); clearInterval(healthkitIntervalId); clearInterval(fireIntervalId);
        startPanel.style.display="flex";
    }

    // -------------------------
    // Start Panel & Settings
    // -------------------------
    const startPanel = document.createElement("div");
    startPanel.id="startPanel";
    Object.assign(startPanel.style,{
        position:"absolute",top:0,left:0,width:"100%",height:"100%",background:"linear-gradient(135deg, #000428, #004e92)",
        display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",color:"white",
        fontFamily:"Arial, sans-serif",zIndex:10,transition:"opacity 0.5s",opacity:1
    });
    startPanel.innerHTML=`
        <h1 style="font-size:3rem;margin-bottom:40px;text-shadow: 2px 2px 10px cyan;">Space Shooter</h1>
        <button class="menu-btn">Start Game</button>
        <button class="menu-btn">Settings</button>
        <button class="menu-btn">Exit</button>
    `;
    document.body.appendChild(startPanel);

    const [startBtn, settingsBtn, exitBtn] = startPanel.querySelectorAll(".menu-btn");

    startPanel.querySelectorAll(".menu-btn").forEach(btn=>{
        Object.assign(btn.style,{
            margin:"10px",padding:"15px 50px",fontSize:"1.2rem",cursor:"pointer",
            border:"none",borderRadius:"10px",background:"white",color:"black",transition:"all 0.3s",boxShadow:"0 0 10px #00ffff"
        });
        btn.onmouseover=()=>{ btn.style.background="cyan"; btn.style.transform="scale(1.1)";}
        btn.onmouseout=()=>{ btn.style.background="white"; btn.style.transform="scale(1)";}
    });

    exitBtn.addEventListener("click", ()=>{ window.close(); });

    // Settings Panel
    const settingsPanel = document.createElement("div");
    settingsPanel.id="settingsPanel";
    Object.assign(settingsPanel.style,{
        position:"absolute",top:0,left:0,width:"100%",height:"100%",background:"rgba(0,0,0,0.9)",
        display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",color:"white",
        fontFamily:"Arial, sans-serif",zIndex:11,transition:"opacity 0.5s",opacity:0,display:"none"
    });
    settingsPanel.innerHTML=`
        <h1 style="font-size:2.5rem;margin-bottom:30px;">Settings</h1>
        <label>Music Volume: <input type="range" id="musicVol" min="0" max="1" step="0.05" value="${bgMusic.volume}"></label><br><br>
        <label>Sound Effects: <input type="range" id="sfxVol" min="0" max="1" step="0.05" value="1"></label><br><br>
        <label>Difficulty:
            <select id="difficulty">
                <option value="easy">Easy</option>
                <option value="medium" selected>Medium</option>
                <option value="hard">Hard</option>
            </select>
        </label><br><br>
        <button id="settingsBack">Back</button>
    `;
    document.body.appendChild(settingsPanel);

    const musicVol = settingsPanel.querySelector("#musicVol");
    const sfxVol = settingsPanel.querySelector("#sfxVol");
    const difficultySelect = settingsPanel.querySelector("#difficulty");
    const settingsBack = settingsPanel.querySelector("#settingsBack");

    musicVol.addEventListener("input", ()=>{ bgMusic.volume = musicVol.value; });
    sfxVol.addEventListener("input", ()=>{ [shootSound,enemyHitSound,healthSound,playerHitSound].forEach(s=>s.volume=sfxVol.value); });

    settingsBtn.addEventListener("click", ()=>{
        startPanel.style.display="none";
        settingsPanel.style.display="flex";
        settingsPanel.style.opacity=1;
    });

    settingsBack.addEventListener("click", ()=>{
        settingsPanel.style.opacity=0;
        setTimeout(()=>{ settingsPanel.style.display="none"; startPanel.style.display="flex"; startPanel.style.opacity=1; },500);
    });

    startBtn.addEventListener("click", ()=>{
        if(gameStarted) return;
        gameStarted = true;
        startPanel.style.opacity=0;
        setTimeout(()=>{ startPanel.style.display="none"; },500);
        bgMusic.play().catch(()=>{});

        const difficulty = difficultySelect.value;
        let enemyInterval = 1500;
        if(difficulty==="easy") enemyInterval=2000;
        else if(difficulty==="hard") enemyInterval=1000;

        enemyIntervalId = setInterval(spawnEnemies, enemyInterval);
        healthkitIntervalId = setInterval(spawnHealthkit,15000);
        fireIntervalId = setInterval(fireBullet,300);
        animate();
    });

    // -------------------------
    // Game Loop
    // -------------------------
    function animate(){
        requestAnimationFrame(animate);
        c.clearRect(0,0,canvas.width,canvas.height);

        // Draw Score & Health
        c.fillStyle="white"; c.font="20px Arial";
        c.fillText("Health: "+health,10,30);
        c.fillText("Score: "+score,canvas.width-140,30);

        // Boss Alert
        if(score >= 100 && !bossShown){
            bossShown = true;
            const alertDiv = document.createElement("div");
            Object.assign(alertDiv.style,{
                position:"absolute",top:"40%",left:"50%",transform:"translate(-50%, -50%)",color:"red",
                fontSize:"3rem",fontFamily:"Arial, sans-serif",textShadow:"2px 2px 10px black",zIndex:20
            });
            alertDiv.innerText="BOSS IS COMING!";
            document.body.appendChild(alertDiv);
            setTimeout(()=>{ alertDiv.remove(); },3000);

            // Spawn boss
            boss = new Boss(canvas.width/2 - 100, -150, 200, 150, bossImg);
        }

        // Update Player
        player.update();

        // Update Bullets
        for(let i=bullets.length-1;i>=0;i--){
            bullets[i].update();
            if(bullets[i].y+bullets[i].height<0) bullets.splice(i,1);
        }

        // Update Enemies
        for(let i=enemies.length-1;i>=0;i--){
            enemies[i].update();
            if(enemies[i].y>canvas.height){
                enemies.splice(i,1);
                health-=10;
                playerHitSound.play().catch(()=>{});
                if(health<=0){ showGameOver(); return; }
            }
        }

        // Update Healthkits
        for(let i=healthkits.length-1;i>=0;i--){
            healthkits[i].update();
            if(healthkits[i].y>canvas.height) healthkits.splice(i,1);
        }

        // Bullet Collisions
        for(let i=bullets.length-1;i>=0;i--){
            for(let j=enemies.length-1;j>=0;j--){
                if(collision(bullets[i],enemies[j])){
                    explosions.push(new Explosion(enemies[j].x+enemies[j].width/2,enemies[j].y+enemies[j].height/2));
                    bullets.splice(i,1);
                    enemies.splice(j,1);
                    score++;
                    enemyHitSound.play().catch(()=>{});
                    break;
                }
            }
            if(boss && collision(bullets[i], boss)){
                boss.health--;
                bullets.splice(i,1);
                enemyHitSound.play().catch(()=>{});
                if(boss.health<=0){
                    explosions.push(new Explosion(boss.x + boss.width/2, boss.y + boss.height/2));
                    boss.stopFiring();
                    boss = null;
                    score += 50;
                }
                break;
            }
            for(let j=healthkits.length-1;j>=0;j--){
                if(collision(bullets[i],healthkits[j])){
                    bullets.splice(i,1);
                    healthkits.splice(j,1);
                    health=Math.min(100,health+10);
                    healthSound.play().catch(()=>{});
                    break;
                }
            }
        }

        // Update Explosions
        for(let i=explosions.length-1;i>=0;i--){
            explosions[i].update();
            if(explosions[i].done()) explosions.splice(i,1);
        }

        // Update Boss
        if(boss) boss.update();

        // Update Boss Bullets
        for(let i=bossBullets.length-1;i>=0;i--){
            bossBullets[i].update();
            if(collision(bossBullets[i], player)){
                health -= 15;
                playerHitSound.play().catch(()=>{});
                bossBullets.splice(i,1);
                if(health<=0){ showGameOver(); return; }
                continue;
            }
            if(bossBullets[i].y > canvas.height) bossBullets.splice(i,1);
        }
    }

    // -------------------------
    // Game Over Panel
    // -------------------------
    function showGameOver(){
        clearInterval(enemyIntervalId); clearInterval(healthkitIntervalId); clearInterval(fireIntervalId);
        if(boss) boss.stopFiring();

        const gameOverPanel = document.createElement("div");
        Object.assign(gameOverPanel.style,{
            position:"absolute",top:0,left:0,width:"100%",height:"100%",background:"rgba(0,0,0,0.85)",
            display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",color:"white",
            fontFamily:"Arial, sans-serif",zIndex:20
        });
        gameOverPanel.innerHTML=`
            <h1 style="font-size:4rem;margin-bottom:20px;text-shadow:2px 2px 10px red;">GAME OVER</h1>
            <p style="font-size:2rem;margin-bottom:30px;">Score: ${score}</p>
            <button id="restartBtn" style="padding:15px 40px;font-size:1.5rem;border:none;border-radius:10px;cursor:pointer;background:cyan;color:black;">Restart</button>
        `;
        document.body.appendChild(gameOverPanel);

        const restartBtn = gameOverPanel.querySelector("#restartBtn");
        restartBtn.addEventListener("click", ()=>{
            gameOverPanel.remove();
            restartGame();
        });
    }
};
            