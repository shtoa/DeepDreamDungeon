import {InputController} from "./InputController.js"
import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';

import { GunController} from "./GunController.js";
import { scene } from "./main.js";

// Code Adapted from tutorial by Simon Dev: https://www.youtube.com/watch?v=oqKzxPMLWxo&ab_channel=SimonDev
export {inputController}

var inputController;

export class FirstPersonCamera{
    constructor(camera){
        
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

        //https://medium.com/@brazmogu/physics-for-game-dev-a-platformer-physics-cheatsheet-f34b09064558#:~:text=So%2C%20given%20a%20value%20g,the%20initial%20velocity%20v'%20is%E2%80%A6&text=Thus%2C%20v'%C2%B2%20%3D%202Hg,of%202%20*%20H%20*%20g.

        this._jumpHeight = 25;
        this._jumpDuration = 0.25;
        this._gravity = this._jumpHeight / (2 * Math.pow(this._jumpDuration,2));
     
        this._isGrounded = true; 

        this._lateralAcceleration = 500;
        this._drag = 250;
        this._maxLateralVelocity = 120;
        this._lateralVelocity = new THREE.Vector2(0, 0);


        this._maxSprintVelocity = 180;
        this._sprintAcceleration = 600;
        this.isSprinting = false;

        //#endregion

        this.GunController = new GunController(camera, this);
        this.teleportEvent = new Event("teleport");

    }

    update(delta){
    
        if(!(document.pointerLockElement===null)||  ('ontouchstart' in window) ){
        
            
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
        this._updateCameraFov();
        this._camera.updateWorldMatrix(true,true); // important for objects that are linked to camera
    }

    _updateCameraFov(){

        // FIX ME: Do THis Propperlly 

        // if(this.isSprinting){
        //     if(this._lateralVelocity.length()>this._maxLateralVelocity){
        //         this._camera.setFocalLength(this._camera.getFocalLength()-2*(this._lateralVelocity.length())/(170));
        //     }
        // }

    }

    _updateTranslation(delta){
        // handle inputs

        if(this._input._keys["16"]){
            this.isSprinting = true;
        } else {
            this.isSprinting = false;
        }


        if(this._input._keys["32"] && this._isGrounded){
            this._verticalVelocity += Math.sqrt(this._jumpHeight * 2 * this._gravity);
            this._isGrounded = false;
        }

        var forwardV, strafeV;

        if(!('ontouchstart' in window)){
            forwardV = ((this._input._keys["87"] ? 1 : 0) + (this._input._keys["83"] ? -1 : 0));
            strafeV = ((this._input._keys["65"] ? 1 : 0) + (this._input._keys["68"] ? -1 : 0));
        } else {
            forwardV =  -1*this._input._moveDir.y;
            strafeV =  -1*this._input._moveDir.x;
        }

        var movementDir = new THREE.Vector2(forwardV, strafeV).normalize();
        var velocityDelta = movementDir.clone().multiplyScalar(
            this.isSprinting ? this._sprintAcceleration*delta : this._lateralAcceleration*delta
        );
        this._lateralVelocity = this._lateralVelocity.clone().add(velocityDelta);

        var curDrag = this._lateralVelocity.clone().normalize().clone().multiplyScalar(this._drag*delta);
        this._lateralVelocity = (this._lateralVelocity.length() > this._drag*delta) ? this._lateralVelocity.clone().sub(curDrag) : new THREE.Vector2(0,0);


        this._lateralVelocity.clampLength(0, this.isSprinting ? this._maxSprintVelocity : this._maxLateralVelocity);

        // handle walking
        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0,1,0), this._phi);

        // add forward walking (forward-backward)
        const forward = new THREE.Vector3(0,0,-1);
        forward.applyQuaternion(qx);
        forward.multiplyScalar(this._lateralVelocity.x*delta);

        // add strafe (left-right)
        const left = new THREE.Vector3(-1,0,0);
        left.applyQuaternion(qx);
        left.multiplyScalar(this._lateralVelocity.y*delta);

        // add jump
        const up = new THREE.Vector3(0,1,0);
        up.multiplyScalar(this._verticalVelocity*delta);

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
            this._verticalVelocity -= this._gravity*delta;
            
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
        // fixme to not constantly run
        if(scene.userData.inPortal){
            
            var portalBounds = scene.userData.inPortal._portal.userData.bounds.clone();

            // check if collides with portal
            portalBounds = portalBounds.clone().expandByVector(new THREE.Vector3(Math.abs(scene.userData.inPortal.normal.x), Math.abs(scene.userData.inPortal.normal.y)*((2*10)/3), Math.abs(scene.userData.inPortal.normal.z)).multiplyScalar(3));

            //#region Collision Debugging
            //this._scene.remove(this.box);
            //this.box = new THREE.Box3Helper( pBounds, 0xffff00 );
            //this._scene.add( this.box );
            //#endregion 

            if (portalBounds.containsPoint(translationNextFrame) && this.GunController.portalTest.isOpen){

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

                    document.dispatchEvent(this.teleportEvent);

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
    _updateRotation(){

        // delta mouse 
        const xh = this._input._current.mouseXDelta / window.innerWidth;
        const yh = this._input._current.mouseYDelta / window.innerHeight;

        // convert to spherical coordinates
        this._phi += -xh*5;
        this._theta = THREE.MathUtils.clamp(this._theta + -yh*5, -Math.PI / 2.1, Math.PI / 2.1);
   
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