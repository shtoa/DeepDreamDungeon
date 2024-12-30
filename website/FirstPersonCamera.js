import {InputController} from "./InputController.js"
//import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';


import {Portal} from "./Portal.js";
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.170.0/three.module.js';

import { DecalGeometry } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/geometries/DecalGeometry.js';

// Code Adapted from tutorial by Simon Dev: https://www.youtube.com/watch?v=oqKzxPMLWxo&ab_channel=SimonDev

export class FirstPersonCamera{
    constructor(camera, roomBounds, room, roomBounds2, room2, curRoom, portalRoom){
        
        this._camera = camera;
        this._input = new InputController();
        
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

        //#region Gun Firing
        this._fireEvent = new Event("fire");
        document.addEventListener("fire", this._placePortal.bind(this)); // research about this
        document.addEventListener("fire", ()=>{console.log("fired")});

        this._cooldownTimer = new THREE.Clock();
        this._cooldown = 0;
        //#endregion


        //#region Portal
        this._roomBounds = roomBounds;
        this._surfaces = room.surfaces;
        this._surfaces2 = room2.surfaces;
        this.curRoom = curRoom;
        this.portalRoom = portalRoom;

        this.center2 = new THREE.Vector3();
        roomBounds2.getCenter(this.center2);

        this._roomBounds2 = roomBounds2;

        //#endregion

    }

    update(delta){
    
        if(!(document.pointerLockElement===null)){
            this._updateRotation(delta);
         
            if(this._cooldownTimer.getElapsedTime() >= this._cooldown){
                this._checkFire();
            }

            this._input.update(delta);

            this._updateCamera(delta);

            if(this.portalTest){
                this.portalTest._updatePortal();
            }

            this._updateTranslation(delta);
        }
    }


    _checkFire(){
        // check cooldown
        if(!this._input._current.leftButton && this._input._previous?.leftButton){
            
            this._cooldown = 0.5;
            this._cooldownTimer.stop();

            document.dispatchEvent(this._fireEvent)

            this._cooldownTimer.start();
        }
    }

    _updateCamera(_){
        this._camera.quaternion.copy(this._rotation);
        this._camera.position.copy(this._translation);
        this._camera.updateWorldMatrix(true,true); // important for objects that are linked to camera
    }

    
    _calculateExitPortalPosition(){
       
        // TODO: Move this Section as Properties of Rooms
        // currentRoom 

        var curRoomSize = new THREE.Vector3();
        this._roomBounds.getSize(curRoomSize);

        var curRoomCenter = new THREE.Vector3();
        this._roomBounds.getCenter(curRoomCenter);
        
        // Destination
        var destinationRoomSize = new THREE.Vector3();
        this._roomBounds2.getSize(destinationRoomSize);

        var destinationRoomCenter = new THREE.Vector3();
        this._roomBounds2.getCenter(destinationRoomCenter);
        
        var roomSizeRatio = destinationRoomSize.length() / curRoomSize.length();
        
        // calculate position 
        var curPortalPosFromCenter = this.portalTest._portal.position.clone().sub(curRoomCenter); // the current position of the portal from the roomCenter
        var newPortalPosFromCenter = curPortalPosFromCenter.clone().multiplyScalar(roomSizeRatio); // the position of the portal in the other room
        newPortalPosFromCenter = newPortalPosFromCenter.reflect(this.portalNormal); // reflect the portal position to be on the opposite side of the destination room

        this.secondPortalPos = newPortalPosFromCenter.clone().add(destinationRoomCenter);
    }

   
    // run place portal function when the gun fires
    
    _placePortal(){
        
        const raycaster = new THREE.Raycaster(); // intialize raycaster 
        raycaster.setFromCamera({x:0,y:0}, this._camera); // 

        const hits = raycaster.intersectObjects(this._surfaces) // check if raycaster intersect any of the surfaces

        // if no hits detected return 
        if(!hits.length){
            return;
        }

        const position = hits[0].point.clone(); // set position to the closest hit
        const eye = position.clone();
        eye.add(hits[0].face.normal);

        const rotation = new THREE.Matrix4();

        var wDir = new THREE.Vector3();
        this._camera.getWorldDirection(wDir)

        var normal = hits[0].face.normal;

        this.portalNormal = normal;

        rotation.lookAt(eye, position, THREE.Object3D.DEFAULT_UP);

        const euler = new THREE.Euler();
        euler.setFromRotationMatrix(rotation);

        if(this.portalTest){
            this.portalTest._removePortal(); // clean up previous portal if it exists
        }

        this.portalTest = new Portal(this._camera); // create entry portal

        var newPortal = new THREE.Mesh(this.portalTest.portalGeom, this.portalMaterial);
        newPortal.recieveShadow = true;

        newPortal.position.copy(hits[0].point) 
                
        const n = normal.clone();
        n.transformDirection(hits[0].object.matrixWorld);
        n.add(newPortal.position);

        newPortal.up.copy(wDir.multiplyScalar((normal.clone().dot(THREE.Object3D.DEFAULT_UP))).add(THREE.Object3D.DEFAULT_UP)) /// redo this research how rto do projection

        newPortal.lookAt(n);

        const hit = hits[0]
        
     
        if(this.outPortal){
            this.outPortal._removePortal();
        }
  
     
        this.portalTest._placePortal(hit, newPortal);


        this.outPortal = new Portal(this._camera); // create exit portal 
        this._calculateExitPortalPosition(); // calculate position of exit portal
        this.outPortal.position = this.secondPortalPos;   
        
        this.portalTest.linkPortal(this.outPortal.position);

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
        var smallBox = this._roomBounds.clone();
        smallBox.expandByScalar(-0.25);
 
        // check if translation is possible
        if(smallBox.containsPoint(translationNextFrame)){
            this._translation.copy(translationNextFrame);
        } 
         

        if(this.portalTest){
            var pBounds = this.portalTest._portal.userData.bounds.clone();

            // check if collides with portal
            pBounds.expandByVector(new THREE.Vector3(Math.abs(this.portalNormal.x), Math.abs(this.portalNormal.y)*((2*10)/3), Math.abs(this.portalNormal.z)).multiplyScalar(3))

        // BOX DEBUGGING
        //this._scene.remove(this.box);
        //this.box = new THREE.Box3Helper( pBounds, 0xffff00 );
        //this._scene.add( this.box );

        if (pBounds.containsPoint(translationNextFrame)){

            // check if collides with room

            //console.log("collides portal")

            var newRBounds = this._roomBounds2.clone();

            var newPosCamera = this.portalTest.portalCamera.position.clone().add(translationNextFrame.clone().sub(this._translation)); // add the new translation to the camera

            if(this.portalNormal.y != 0){
                this._groundPosition = new THREE.Vector3(0,this._roomBounds.min.y-10,0);
            }

            if(newRBounds.containsPoint(newPosCamera)){
            //console.log("TRANSFERED")
            
            // switch rooms if the player intersect portal
            // FIX ME: Player Does not fully fall Through Floor
            // FIX ME: Create a copy / clone constructor to easily create new object 

              
                this._translation = this.portalTest.portalCamera.position.clone().add(translationNextFrame.clone().sub(this._translation));
                var tempBounds  = this._roomBounds;
                
                this._roomBounds = this._roomBounds2;
                this._roomBounds2 = tempBounds;
                
                this._groundPosition = new THREE.Vector3(0,this._roomBounds.min.y+10,0);

                var tempSurfaces  = this._surfaces;
                this._surfaces = this._surfaces2;
                this._surfaces2 = tempSurfaces;

                this.center2 = new THREE.Vector3();
                this._roomBounds2.getCenter(this.center2);

                var tempRoom = this.portalRoom;
                this.portalRoom = this.curRoom;
                this.curRoom = tempRoom;

           
            } 
        } else {
            this._groundPosition = new THREE.Vector3(0,this._roomBounds.min.y + 10,0); // stops player from sinking in portal when quickly going away from it
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