import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';

export class Button{
    constructor(position,text){
        this.buttonBackground;
        this.button;

        
        
        this.createJoystickDiv(position, text);
    
        this.buttonBr = this.button.getBoundingClientRect();
        this.restButtonPosition = new THREE.Vector2(this.buttonBr.x, this.buttonBr.y);
        this.newButtonPosition = this.restButtonPosition.clone();
        this.isPressed = false;
        this.touchID = null;

        this.addTouchListeners();

    }

    addTouchListeners(){

        this.button.addEventListener("touchstart", (e) => {this.onTouchStart(e)},false)
   
        this.button.addEventListener("touchend", (e)=>{
            e.preventDefault();
    
            this.isPressed = false;
            this.touchID = null;
    
        }, false)    
    }
    
    onTouchStart(e){

        if(e.changedTouches && this.touchID === null){
            console.log("new Touch")
            this.touchID = e.changedTouches[0].identifier;
        }

        e.preventDefault();

        for(var i = 0; i < e.touches.length; i++) {

            var touch = e.touches[i]

            if(touch.identifier == this.touchID){
                this.isPressed = true;
            }
        }
    

    }

    createJoystickDiv(position, text){
        // joystick background
        this.button = document.createElement("div")
        this.button.width = 50;
        this.button.height = 50;
        this.button.style.width = "50px";
        this.button.style.height = "50px";
        this.button.style.position = "absolute";
        
        this.button.style.left = position.left || "0%";
        this.button.style.bottom = position.bottom || "0%";
        this.button.style.right = position.right || "0%";
        this.button.style.top = position.top || "0%";

        this.button.style.backgroundColor = "red";
        this.button.style.borderRadius = "100px";
        this.button.innerHTML = text
        document.body.prepend(this.button)

    
    }



}