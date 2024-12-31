import { inputController } from "./FirstPersonCamera.js";
import { Portal } from "./Portal.js";
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.170.0/three.module.js';
import { TWEEN } from 'https://unpkg.com/three@0.139.0/examples/jsm/libs/tween.module.min.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/FBXLoader.js';
import {scene} from './Index.js'

// FIX ME USE STATE MACHINE FOR ANIMATIONS

export class GunController{
    
    constructor(camera){
        
        this.firingAnim;
        this.ammoCount = 1;

        this._camera = camera;
        this.loadGunModel();

        this.isSpinning = false;

        this._fireEvent = new Event("fire");
        document.addEventListener("fire", this._placePortal.bind(this)); // research about this
        document.addEventListener("fire", ()=>{console.log("fired")});

        this._cooldownTimer = new THREE.Clock();
        this._cooldown = 0;

        document.addEventListener("fire", ()=>{

            // if(!this.firingAnim?.isPlaying()){
            //     this.firingAnim = new TWEEN.Tween(this.gunModel.rotation).to({x:1},200).yoyo(true)
            //     .repeat(1)
            //     .easing(TWEEN.Easing.Cubic.InOut)
            //     .start()
            //     this.gunModel.updateMatrix();
            //     scene.userData.changingScene = true;
            // }

            this.mixer.stopAllAction();
            this.animationsMap["shoot"].play();
            scene.userData.changingScene = true;

            this.isSpinning = false;
        });
        this.animationsMap = new Object();

    }

    loadGunModel(){
        var fLoader = new FBXLoader();
  
    
        fLoader.load("handTest.fbx", (object)=>
        {
    
            object.position.set(0.1,-0.08,-0.3)
    
            var scale = 0.0008;
            object.scale.set(scale,scale,scale);
      
            scene.add(object)
           
            this.gunModel = object;
    
            const video = document.getElementById( 'video' );
            const texture = new THREE.VideoTexture( video )

            this.gunModel.getObjectByName("cameraOrb").material.map = texture;

            console.log(object.animations);


            this.mixer = new THREE.AnimationMixer( object );
            this.animationsMap["flip"] = this.mixer.clipAction( object.animations[ 5 ] );
            this.animationsMap["flip"].loop = THREE.LoopOnce;


            this.animationsMap["startFlip"] = this.mixer.clipAction( object.animations[ 4 ] );
            this.animationsMap["startFlip"].clampWhenFinished = true;
            this.animationsMap["startFlip"].loop = THREE.LoopOnce;


            this.animationsMap["stopFlip"] = this.mixer.clipAction( object.animations[ 2 ] );
            this.animationsMap["stopFlip"].clampWhenFinished = true;
            this.animationsMap["stopFlip"].loop = THREE.LoopOnce;
            this.animationsMap["stopFlip"].setDuration(0.4);


            this.animationsMap["shoot"] = this.mixer.clipAction( object.animations[ 3 ] );
            this.animationsMap["shoot"].clampWhenFinished = true;
            this.animationsMap["shoot"].loop = THREE.LoopOnce;
        

            this.animationsMap["reloadArms"] = this.mixer.clipAction( object.animations[ 0 ] );
            this.animationsMap["reloadArms"].clampWhenFinished = true;
            this.animationsMap["reloadArms"].loop = THREE.LoopOnce;

            
            this.animationsMap["reloadOrb"] = this.mixer.clipAction( object.animations[ 1 ] );
            this.animationsMap["reloadOrb"].clampWhenFinished = true;
            this.animationsMap["reloadOrb"].loop = THREE.LoopOnce;

            this.isSpinning = false;
            this.mixer.timeScale = 1.5; // set timescale to help with speed of animation
            this.mixer.addEventListener("finished", (e) => {
                console.log(e)
                if(e.action._clip.name == "arm|spinStart"){
                    
                    if(!this.animationsMap["stopFlip"].isRunning()){
                        this.animationsMap["startFlip"].fadeOut(0.1);
                        this.animationsMap["flip"].reset().play();
                        //this.animationsMap.loop = THREE.LoopRepeat;
                        this.isSpinning = true;
                    }

                }


                if(e.action._clip.name == "arm|spinStop"){
                    this.animationsMap["stopFlip"].stop();
                    //this.animationsMap["flip"].stop();

                    this.isSpinning = false;
                }

                if(e.action._clip.name == "arm|shootPortal"){
                    this.animationsMap["shoot"].stop();
                    this.animationsMap["flip"].stop();
                    this.isSpinning = false;
                }

                // FIX ME: MAKE SAME LENGTH ANIMATION

                if(e.action._clip.name == "cameraOrb|reload" && !this.animationsMap["reloadArms"].isRunning()){
                    this.animationsMap["reloadOrb"].stop();
                    this.animationsMap["reloadArms"].stop();
                    this.animationsMap["flip"].stop();
                    this.ammoCount = 1;
                   
                }

                if(e.action._clip.name == "arm|reload.001" && !this.animationsMap["reloadOrb"].isRunning()){
                    this.animationsMap["reloadArms"].stop();
                    this.animationsMap["reloadOrb"].stop();
                    this.animationsMap["flip"].stop();
                    this.ammoCount = 1;
              
                }

                if(e.action._clip.name == "arm|shootPortal"){
                    this.animationsMap["shoot"].stop();
                    this.animationsMap["shoot"].reset();
                    this.animationsMap["flip"].stop();
                    
                }

                if(e.action._clip.name == "arm|spin"){
              
                    this.animationsMap["stopFlip"].play();
                    this.isSpinning = false;
                }


            })

            console.log(this.gunModel)

            this.gunModel.children.forEach(child => {
                    child.renderOrder = -1
                }
            )
    
            object.parent = this._camera;
    
        });
    
    
    }

    update(){
        if(this._cooldownTimer.getElapsedTime() >= this._cooldown && this.ammoCount != 0){
            this._checkFire();
        }

        if(this.portalTest){
            this.portalTest._updatePortal();
        }

  
        this.mixer.update(scene.userData.globalDelta) // FIXME MAKE SURE MIXER IS INITIALIZED

       

        if(inputController._keys["82"] && this.ammoCount == 0 && !this.animationsMap["shoot"].isRunning() && !this.animationsMap["stopFlip"].isRunning()  && !this.animationsMap["reloadOrb"].isRunning() && !this.animationsMap["reloadArms"].isRunning()){
            
            this.animationsMap["startFlip"].stop(); 
            this.animationsMap["flip"].loop = THREE.LoopOnce;
            // check if spinning complete spin
            
            if(!this.animationsMap["flip"].isRunning()){
                this._reload();
            }
        }

   

        else if(inputController._keys["70"] && !this.animationsMap["shoot"].isRunning() && !this.animationsMap["reloadOrb"].isRunning() && !this.animationsMap["reloadArms"].isRunning() && !this.animationsMap["stopFlip"].isRunning()){
            this._spinGun();
        } 
        
        else if (this.isSpinning && !this.animationsMap["stopFlip"].isRunning() && !this.animationsMap["startFlip"].isRunning()) {
            
            //this.animationsMap["startFlip"].stop(); 
            this.animationsMap["flip"].loop = THREE.LoopOnce;
            
        } else if(!this.animationsMap["stopFlip"].isRunning() && !this.isSpinning){

            if(this.animationsMap["startFlip"].isRunning()){
                this.animationsMap["startFlip"].fadeOut(0.1)
                this.animationsMap["stopFlip"].play();
 
            }
        } else {
            //
        }


  
          

    }

    _checkIsAnimationPlaying(){
        for (const animationName in this.animationsMap) {
            if(this.animationsMap[animationName].isRunning()){
                return true;
            }
        }

        return false;

    }

    _reload(){
        this.animationsMap["reloadOrb"].play();;
        this.animationsMap["reloadArms"].play();
    }

    _spinGun(){
    
   
        if (this.isSpinning == false){
            if(!this.animationsMap["startFlip"].isRunning()){
                this.animationsMap["startFlip"].reset();
                
            }
            console.log("startingSpin")
            this.animationsMap["startFlip"].play();
        } else {
            this.animationsMap["flip"].loop = THREE.LoopRepeat;
        }
    }

    _checkFire(){
        // check cooldown
        if(!inputController._current.leftButton && inputController._previous?.leftButton){
            
            this._cooldown = 0.5;
            this._cooldownTimer.stop();

            document.dispatchEvent(this._fireEvent)
            this.ammoCount -= 1;

            this._cooldownTimer.start();
        }
    }

    _calculateExitPortalPosition(){
       
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
        const hits = raycaster.intersectObjects(scene.userData.portalableSurfaces) // check if raycaster intersect any of the surfaces

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

        this.outPortal = new Portal(this._camera); // create exit portal
        
        this._calculateExitPortalPosition(); // calculate position of exit portal
        this.outPortal.position = this.secondPortalPos;   
        
        this.portalTest.linkPortal(this.outPortal.position);

    }


}