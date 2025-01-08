import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';
import { Joystick } from './joystick.js';

// code created by following tutorial by SimonDev: https://www.youtube.com/watch?v=oqKzxPMLWxo&ab_channel=SimonDev
export class InputController{
    constructor(){
        this._initialize();
    }

    _initialize(){
        
        if( ('ontouchstart' in window)){
            this._initializeTouchControls();
        }

        this._current = {
            leftButton: false,
            rightButton: false,
            mouseX: 0,
            mouseY: 0,
            mouseXDelta: 0,
            mouseYDelta: 0,
        }

        this._previous = null; 
        this._keys = {};
        this._prevKeys = {};
        this._isTouching;
        this._touchMoved = false;
        this._tap = false;
        this._firstMove = true;

        this._moveDir = new THREE.Vector2(0,0);

        document.addEventListener('mousedown', (e)=> this._onMouseDown(e), false);
        document.addEventListener('mouseup', (e)=> this._onMouseUp(e), false);
        document.addEventListener('mousemove', (e)=> this._onMouseMove(e), false);
        document.addEventListener('keydown', (e)=> this._onKeyDown(e), false);
        document.addEventListener('keyup', (e)=> this._onKeyUp(e), false);

    }



    _initializeTouchControls(){
    
        this.lookingJoystick = new Joystick({left:"80%", right:"0%", bottom: "10%", top:"60%"});
        this.movementJoystick = new Joystick({left:"10%", right:"0%", bottom: "10%", top:"60%"});

    }  

    _updateTouchControls(){
        this._moveDir.copy(this.movementJoystick.joyStickDelta);
        this._current.mouseYDelta = this.lookingJoystick.joyStickDelta.y*3;
        this._current.mouseXDelta = this.lookingJoystick.joyStickDelta.x*3;
    }

    _onMouseDown(e){
        switch(e.button){
            case 0:
                this._current.leftButton = true;
                break
            case 2: {
                this._current.rightButton = true;
                break;
            }
        }
    }

    _onMouseUp(e){
        switch(e.button){
            case 0:
                this._current.leftButton = false;
                break
            case 2: {
                this._current.rightButton = false;
                break;
            }
        }
    }

    _onMouseMove(e){
        

        this._current.mouseX = e.pageX - window.innerWidth / 2;
        this._current.mouseY = e.pageY - window.innerHeight / 2;

        if(this._previous === null){
            this._previous = {...this._current};
        } 

        this._current.mouseXDelta = e.movementX / 2;
        this._current.mouseYDelta = e.movementY / 2;
        
    }

    _onKeyDown(e){
        this._keys[e.keyCode] = true;
    }

    _onKeyUp(e){
        this._keys[e.keyCode] = false;
    }

    update(){
        this._previous = {...this._current};
        
        this._current.mouseXDelta = 0;
        this._current.mouseYDelta = 0;

        if( ('ontouchstart' in window)){
            this._updateTouchControls();
        }
    
    }

}