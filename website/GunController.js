import { inputController } from "./FirstPersonCamera.js";
import { Portal } from "./Portal.js";
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.170.0/three.module.js';
import { TWEEN } from 'https://unpkg.com/three@0.139.0/examples/jsm/libs/tween.module.min.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/FBXLoader.js';
import {scene} from './Index.js'


export class GunController{
    
    constructor(camera){
        
        this.firingAnim;

        this._camera = camera;
        this.loadGunModel();

        this._fireEvent = new Event("fire");
        document.addEventListener("fire", this._placePortal.bind(this)); // research about this
        document.addEventListener("fire", ()=>{console.log("fired")});

        this._cooldownTimer = new THREE.Clock();
        this._cooldown = 0;

        document.addEventListener("fire", ()=>{

            if(!this.firingAnim?.isPlaying()){
                this.firingAnim = new TWEEN.Tween(this.gunModel.rotation).to({x:1},200).yoyo(true)
                .repeat(1)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start()
                this.gunModel.updateMatrix();
                scene.userData.changingScene = true;
            }
        });

    }

    loadGunModel(){
        var fLoader = new FBXLoader();
    
        fLoader.load("gun.fbx", (object)=>
        {
    
            object.position.set(0.1,-0.08,-0.3)
    
            var scale = 0.0008;
            object.scale.set(scale,scale,scale);
      
            scene.add(object)
           
            this.gunModel = object;
    
            const video = document.getElementById( 'video' );
            const texture = new THREE.VideoTexture( video )

            this.gunModel.children[1].material.map = texture;
    
            this.gunModel.children.forEach(child => {
                    child.renderOrder = -1
             
                
                }
            )
    
            object.parent = this._camera;
    
        });
    
    
    }

    update(){
        if(this._cooldownTimer.getElapsedTime() >= this._cooldown){
            this._checkFire();
        }

        if(this.portalTest){
            this.portalTest._updatePortal();
        }
    }

    _checkFire(){
        // check cooldown
        if(!inputController._current.leftButton && inputController._previous?.leftButton){
            
            this._cooldown = 0.5;
            this._cooldownTimer.stop();

            document.dispatchEvent(this._fireEvent)

            this._cooldownTimer.start();
        }
    }

    _calculateExitPortalPosition(){
       
        // TODO: Move this Section as Properties of Rooms
        // currentRoom 

        // var curRoomSize = new THREE.Vector3();
        // this.curRoom.bounds.getSize(curRoomSize);

        // var curRoomCenter = new THREE.Vector3();
        // this.curRoom.bounds.getCenter(curRoomCenter);
        
        // Destination
        // var destinationRoomSize = new THREE.Vector3();
        // this.destinationRoom.bounds.getSize(destinationRoomSize);

        // var destinationRoomCenter = new THREE.Vector3();
        // this.destinationRoom.bounds.getCenter(destinationRoomCenter); // FIX ME: Move this to actual room class


        var destinationRoom = scene.userData.destinationRoom;
        var curRoom = scene.userData.curRoom;
        
        var roomSizeRatio = destinationRoom._size.length() / curRoom._size.length();
        
        // calculate position 
        var curPortalPosFromCenter = this.portalTest._portal.position.clone().sub(curRoom._center); // the current position of the portal from the roomCenter
        var newPortalPosFromCenter = curPortalPosFromCenter.clone().multiplyScalar(roomSizeRatio); // the position of the portal in the other room
        newPortalPosFromCenter = newPortalPosFromCenter.reflect(this.portalNormal); // reflect the portal position to be on the opposite side of the destination room

        this.secondPortalPos = newPortalPosFromCenter.clone().add(destinationRoom._center);
    }


    _placePortal(){
        
        const raycaster = new THREE.Raycaster(); // intialize raycaster 
        raycaster.setFromCamera({x:0,y:0}, this._camera); // 


        // TODO: Do this in a more global intersection with scene


        // make it only with objects in room
        const hits = raycaster.intersectObjects(scene.children) // check if raycaster intersect any of the surfaces

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
        this.portalTest.normal = normal;
        scene.userData.inPortal = this.portalTest;

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
        //scene.userData.inPortalBounds = this.portalTest._portal.userData.bounds;

        this.outPortal = new Portal(this._camera); // create exit portal
        
        this._calculateExitPortalPosition(); // calculate position of exit portal
        this.outPortal.position = this.secondPortalPos;   
        
        this.portalTest.linkPortal(this.outPortal.position);

    }


}