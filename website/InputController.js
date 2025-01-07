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
            mouseYDelta: 0
        }

        this._previous = null; 
        this._keys = {};
        this._prevKeys = {};

        document.addEventListener('mousedown', (e)=> this._onMouseDown(e), false);
        document.addEventListener('mouseup', (e)=> this._onMouseUp(e), false);
        document.addEventListener('mousemove', (e)=> this._onMouseMove(e), false);
        document.addEventListener('keydown', (e)=> this._onKeyDown(e), false);
        document.addEventListener('keyup', (e)=> this._onKeyUp(e), false);

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

    update(_){
        this._previous = {...this._current};
        
        this._current.mouseXDelta = 0;
        this._current.mouseYDelta = 0;
    }

}