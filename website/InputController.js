import { renderer } from "./main.js";

// code created by following tutorial by SimonDev: https://www.youtube.com/watch?v=oqKzxPMLWxo&ab_channel=SimonDev
export class InputController{
    constructor(){
        this._initialize();
    }

    _initialize(){
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

        document.addEventListener('mousedown', (e)=> this._onMouseDown(e), false);
        document.addEventListener('mouseup', (e)=> this._onMouseUp(e), false);
        document.addEventListener('mousemove', (e)=> this._onMouseMove(e), false);
        document.addEventListener('keydown', (e)=> this._onKeyDown(e), false);
        document.addEventListener('keyup', (e)=> this._onKeyUp(e), false);
        document.getElementById("mainCanvas").addEventListener('touchstart', (e)=> this._onTouchStart(e), false);
        document.getElementById("mainCanvas").addEventListener('touchmove', (e)=> this._onTouchMove(e), false);
        document.getElementById("mainCanvas").addEventListener('touchend', (e)=> this._onTouchEnd(e), false);

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

    _onTouchStart(e){
        e.preventDefault();
        this._isTouching = true;
        console.log("TOUCH STARTED");
        const touch = e.touches[0];

        if(this._previous === null){
            this._previous = {...this._current};
        } 

        this._previous.mouseX = touch.clientX;
        this._previous.mouseY = touch.clientY;

        //console.log(this._previous.mouseY);
        this._tap = false;

    }

    _onTouchMove(e){
        e.preventDefault();

        this._touchMoved = true;

        console.log("TOUCH MOVED");

        const touch = e.touches[0];

        if(this._firstMove){
            this._previous.mouseX = touch.clientX;
            this._previous.mouseY = touch.clientY;

            this._firstMove = false;
        }
        
        this._current.mouseX = touch.clientX;
        this._current.mouseY = touch.clientY;

        this._current.mouseXDelta = this._current.mouseX - this._previous.mouseX;
        this._current.mouseYDelta = this._current.mouseY - this._previous.mouseY;

    }
    _onTouchEnd(e){

        if(!this._touchMoved){
            this._tap = true;
            this._touchMoved = false;
        }

        this._isTouching = false;

        this._firstMove = true;

        e.preventDefault();
        console.log("TOUCH ENDED");


    }


    update(){
        this._previous = {...this._current};
        
        this._current.mouseXDelta = 0;
        this._current.mouseYDelta = 0;
    
    }

}