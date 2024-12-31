import {InputController} from "./InputController.js"
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.170.0/three.module.js';

import { GunController} from "./GunController.js";
import { scene } from "./Index.js";

// Code Adapted from tutorial by Simon Dev: https://www.youtube.com/watch?v=oqKzxPMLWxo&ab_channel=SimonDev
export {inputController}

var inputController;

export class FirstPersonCamera{
    constructor(camera, curRoom, destinationRoom){
        
        this._camera = camera;
        this._input = new InputController();
        inputController = this._input;
        
        //#region rotation and looking around
        this._phi = 0;
        this._theta = 0;
        this._rotation = new THREE.Quaternion();
        //#endregion
        
        //#region movement

        // - for horizontal movement 
        this._translation = camera.position.clone();
        
        // - for vertical movement
        this._groundPosition = new THREE.Vector3(0,10,0);
        this._verticalVelocity = 0;
        this._gravity = 5;
        this._jumpHeight = 0.5;
        this._isGrounded = true; 

        //#endregion

        this.GunController = new GunController(camera);
    }

    update(delta){
    
        if(!(document.pointerLockElement===null)){
        
            
            // order is importants

            this._updateRotation(delta);
            this._updateTranslation(delta);

            this._updateCamera(delta);

            if(this.portalTest){
                this.portalTest._updatePortal();
            }
                 
            this.GunController.update();
            this._input.update(delta);
        
        }
    }

    _updateCamera(_){
        this._camera.quaternion.copy(this._rotation);
        this._camera.position.copy(this._translation);
        this._camera.updateWorldMatrix(true,true); // important for objects that are linked to camera
    }

    _updateTranslation(delta){
        // handle inputs
        if(this._input._keys["32"] && this._isGrounded){
            this._verticalVelocity += Math.sqrt(this._jumpHeight * 2 * this._gravity);
            this._isGrounded = false;
        }

        const forwardV = ((this._input._keys["87"] ? 1 : 0) + (this._input._keys["83"] ? -1 : 0))*120;
        const strafeV = ((this._input._keys["65"] ? 1 : 0) + (this._input._keys["68"] ? -1 : 0))*120;

        // handle walking
        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0,1,0), this._phi);

        // add forward walking (forward-backward)
        const forward = new THREE.Vector3(0,0,-1);
        forward.applyQuaternion(qx);
        forward.multiplyScalar(forwardV*delta);

        // add strafe (left-right)
        const left = new THREE.Vector3(-1,0,0);
        left.applyQuaternion(qx);
        left.multiplyScalar(strafeV*delta);

        // add jump
        const up = new THREE.Vector3(0,1,0);
        up.multiplyScalar(this._verticalVelocity);

        // get translation next frame
        var translationNextFrame = new THREE.Vector3().copy(this._translation);
        
        translationNextFrame.add(forward);
        translationNextFrame.add(left);
        translationNextFrame.add(up);

        this._checkCollisions(translationNextFrame, up);

        // handle jumping next frame
        // FIX ME: Check Order
        // FIX ME: Check visual bug

        if(this._translation.y > this._groundPosition.y){
            this._verticalVelocity -= this._gravity * delta;
            
        } else {
            this._translation.y = this._groundPosition.y
            this._verticalVelocity = 0;
            this._isGrounded = true;
        }
    }

    // move into seperate checking class
    _checkCollisions(translationNextFrame,up){

        // use shrunk roomBounds to check for collisions
        var smallBox = scene.userData.curRoom.bounds.clone(); 
        smallBox.expandByScalar(-0.25);
 
        // check if translation is possible
        if(smallBox.containsPoint(translationNextFrame)){
            this._translation.copy(translationNextFrame);
        } 
        

        // fixme convert to use scene variables
        if(scene.userData.inPortal){
            
            var portalBounds = scene.userData.inPortal._portal.userData.bounds.clone();

            // check if collides with portal
            portalBounds = portalBounds.clone().expandByVector(new THREE.Vector3(Math.abs(scene.userData.inPortal.normal.x), Math.abs(scene.userData.inPortal.normal.y)*((2*10)/3), Math.abs(scene.userData.inPortal.normal.z)).multiplyScalar(3));

            //#region Collision Debugging
            //this._scene.remove(this.box);
            //this.box = new THREE.Box3Helper( pBounds, 0xffff00 );
            //this._scene.add( this.box );
            //#endregion 

            if (portalBounds.containsPoint(translationNextFrame)){

                // check if collides with room
                var newRBounds = scene.userData.destinationRoom.bounds.clone(); // check if the translation is within the new room bounds

                var newPosCamera = scene.userData.inPortal.portalCamera.position.clone().add(translationNextFrame.clone().sub(this._translation)); // add the new translation to the camera

                if(scene.userData.inPortal.normal.y != 0){
                    this._groundPosition = new THREE.Vector3(0,scene.userData.curRoom.bounds.min.y-10,0);
                }

                if(newRBounds.containsPoint(newPosCamera)){ // switch rooms if the player intersect portal
                    // swap rooms
                    var newRoom = scene.userData.destinationRoom;
                    
                    scene.userData.destinationRoom = scene.userData.curRoom;
                    scene.userData.curRoom = newRoom;

                    // fix player translation 
                    this._translation = scene.userData.inPortal.portalCamera.position.clone().add(translationNextFrame.clone().sub(this._translation));
                    this._groundPosition = new THREE.Vector3(0,scene.userData.curRoom.bounds.min.y+10,0); // set new ground position

                } 
            } else {
                this._groundPosition = new THREE.Vector3(0,scene.userData.curRoom.bounds.min.y + 10,0); // stops player from sinking in portal when quickly going away from it
            }
        } 
  
        if (!this._isGrounded){
            this._translation.add(up);
        }
    }
    _updateRotation(delta){

        // delta mouse 
        const xh = this._input._current.mouseXDelta / window.innerWidth;
        const yh = this._input._current.mouseYDelta / window.innerHeight;

        // convert to spherical coordinates
        this._phi += -xh*5;
        this._theta = THREE.MathUtils.clamp(this._theta + -yh*5, -Math.PI / 2, Math.PI / 2);
   
        // rotation around x
        const qx = new THREE.Quaternion();  
        qx.setFromAxisAngle(new THREE.Vector3(0,1,0), this._phi);
   
        // rotation around z
        const qz = new THREE.Quaternion();
        qz.setFromAxisAngle(new THREE.Vector3(1,0,0), this._theta);

        const q = new THREE.Quaternion();
        q.multiply(qx); // rotate around x
        q.multiply(qz); // rotate around z

        this._rotation.copy(q);
    }
}