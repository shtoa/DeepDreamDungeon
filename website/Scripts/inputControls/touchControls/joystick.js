import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';

export class Joystick{
    constructor(position){
        this.joyStick;
        this.joyStickBackground;

        
        
        this.createJoystickDiv(position);
    
        this.defaultJoystickBr = this.joyStick.getBoundingClientRect();
        this.restJoystickPosition = new THREE.Vector2(this.defaultJoystickBr.x, this.defaultJoystickBr.y);
        this.newJoystickPosition = this.restJoystickPosition.clone();
        this.joyStickDelta = new THREE.Vector2(0,0);
        this.touchID = null;

       this.addTouchListeners();

    }

    addTouchListeners(){
        // touch move when the joystick is moving
        //this.joyStick.addEventListener("touchstart", (e) => {this.onTouchStart(e)},false)
        // touch move when the joystick is moving
        this.joyStick.addEventListener("touchmove", (e) => {this.onTouchMove(e)},false)
        // touch end whn the joystick is stopped interacting with 
        this.joyStick.addEventListener("touchend", (e)=>{
            e.preventDefault();
    
            this.joyStick.style.left = "50px"
            this.joyStick.style.bottom = "50px"
    
            this.newJoystickPosition.copy(this.restJoystickPosition.clone());
            this.joyStickDelta.copy(new THREE.Vector2(0,0));

            this.touchID = null;
    
        }, false)    
    }
    
    // onTouchStart(e){
       
    // }

    onTouchMove(e){

        if(e.changedTouches && this.touchID === null){
            console.log("new Touch")
            this.touchID = e.changedTouches[0].identifier;
        }

        e.preventDefault();

        for(var i = 0; i < e.touches.length; i++) {

            var touch = e.touches[i]

            //console.log(e);

            var center = new THREE.Vector2(50,50);
            var dest = new THREE.Vector2(touch.clientX- this.defaultJoystickBr.left+25, this.defaultJoystickBr.bottom-touch.clientY+25);
    
           // console.log(document.elementFromPoint(singleTouch.clientX,singleTouch.clientY));

           //console.log(document.elementFromPoint(touch.clientX,touch.clientY));

            if(touch.identifier == this.touchID){
            if(center.distanceTo(dest) < 50){
                this.joyStick.style.left = String(dest.x)+"px"; // 125
                this.joyStick.style.bottom = String(dest.y)+"px";
            } else {

                dest.sub(center).normalize().multiplyScalar(50);
                this.joyStick.style.left = String(dest.x+50)+"px"; // 125
                this.joyStick.style.bottom = String(dest.y+50)+"px";
            }

            this.newJoystickPosition = new THREE.Vector2(this.joyStick.getBoundingClientRect().x, this.joyStick.getBoundingClientRect().y);

          

            this.joyStickDelta = this.newJoystickPosition.clone().sub(this.restJoystickPosition).multiplyScalar(1/50);
            this.joyStickDelta = this.joyStickDelta.clone().normalize().multiplyScalar(Math.pow(Math.min(this.joyStickDelta.clone().length(),1),4)).multiplyScalar(2);
      
           

 
            
        }
        }
    

    }

    createJoystickDiv(position){
        // joystick background
        this.joyStickBackground = document.createElement("div")
        this.joyStickBackground.width = 150;
        this.joyStickBackground.height = 150;
        this.joyStickBackground.style.width = "150px";
        this.joyStickBackground.style.height = "150px";
        this.joyStickBackground.style.position = "absolute";
        
        this.joyStickBackground.style.left = position.left || "0%";
        this.joyStickBackground.style.bottom = position.bottom || "0%";
        this.joyStickBackground.style.right = position.right || "0%";
        this.joyStickBackground.style.top = position.top || "0%";



        this.joyStickBackground.style.backgroundColor = "red";
        this.joyStickBackground.style.borderRadius = "100px";
        //this.joyStickBackground.id = "joystickDiv"
        document.body.prepend(this.joyStickBackground)

        // joystick
        this.joyStick = document.createElement("img");
        this.joyStick.src = "Assets/Models/player/outOfAmmo.png";
        this.joyStick.width = 50;
        this.joyStick.height = 50;
        this.joyStick.style.left ="50px"
        this.joyStick.style.bottom ="50px"
        this.joyStick.style.position = "absolute";
        this.joyStick.style.borderRadius = "100px";
        this.joyStick.style.backgroundColor = "transparent"
        //this.joyStick.id = "joystickHead";
        this.joyStickBackground.appendChild(this.joyStick );
    
    }



}