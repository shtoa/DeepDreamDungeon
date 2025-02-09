import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js'; // check if there was reason to use older version
import { TWEEN } from 'https://unpkg.com/three@0.128.0/examples/jsm/libs/tween.module.min.js';
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/FBXLoader.js';

import { inputController } from "../cameraControls/FirstPersonCamera.js";
import { Portal } from "./Portal.js";
import {scene, actionList} from './../../main.js'

// FIX ME USE STATE MACHINE FOR ANIMATIONS



export class GunController{

    constructor(camera, FPSController){

        
        //#region destination text canvas
        this.canvasDestination = document.createElement("canvas")
        this.canvasDestination.id = "canvasDestination"
        const context = this.canvasDestination.getContext("2d")
        
        this.canvasDestination.width = 1000;
        this.canvasDestination.height = 100;
    
        context.font = "70px Comic Sans MS";
      
        this.destTexture = new THREE.CanvasTexture(this.canvasDestination);
      
        this.destTexture.wrapS = THREE.RepeatWrapping;
        this.destTexture.wrapT = THREE.RepeatWrapping;
        //#endregion

        //reticle

        this.reticleRotationZ = 0;

        this.reticle  = new THREE.Mesh(
            new THREE.PlaneGeometry( 0.01, 0.01),
            new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide, transparent: true })
        );


        scene.add(this.reticle);
        this.reticle.material.map = new THREE.TextureLoader().load( `Assets/Images/crosshair.png`);

        //#endregion
        
        this.FPSController = FPSController; // FIX ME: DONT PASS IT LIKE THIS

        this.firingAnim;
        this.ammoCount = 1;

        this._camera = camera;

        var wDir = new THREE.Vector3();
        this._camera.getWorldDirection(wDir);

        this.reticle.position.copy(this._camera.position.clone().add(wDir.clone().multiplyScalar(0.21)))
        this.reticle.lookAt(this._camera.position);       

        this.isSpinning = false;
        this.teleporting = false;

        this._fireEvent = new Event("fire");
        document.addEventListener("fire", this._placePortal.bind(this)); // research about this
        document.addEventListener("fire", ()=>{console.log("fired")});

        this._cooldownTimer = new THREE.Clock();
        this._cooldown = 0;

        document.addEventListener("fire", ()=>{


            this.mixer.stopAllAction();
            this.animationsMap["shoot"].play();


            this.isSpinning = false;

            this.cleanSnapshots();

            //recognition.start();
        });
        this.animationsMap = new Object();
        this.isCharged = false;


        this.noAmmoTexture = new THREE.TextureLoader().load("Assets/Models/player/outOfAmmo.png");

        const video = document.getElementById( 'video' );
        this.videoTexture = new THREE.VideoTexture( video )


        this.vertexShader = `
        varying vec4 vPos;
        varying vec4 testPos;
        uniform mat4 camProj;
        uniform mat4 viewMat;
        uniform mat4 model;
        varying vec2 vUv;
        void main() {
            // projectionMatrix
            vPos = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
            //vPos = camProj * viewMat * model * vec4( position, 1.0 );
            //vPos = vec4(position, 1.0);

            //vPos = camProj * viewMat * vec4( position, 1.0 );
            gl_Position = vPos;
            vUv = uv;
            testPos = camProj * model * vec4( position, 1.0 );

        }
    `;
    this.fragmentShader = `
        varying vec4 vPos;
        varying vec4 testPos;
        uniform sampler2D videoTexture;
        uniform sampler2D noAmmoTexture;
        uniform float ammoTime;

        varying vec2 vUv;

    
        void main() {
            
            vec4 noAmmo = texture2D(noAmmoTexture,vUv);
            vec4 vTexture = texture2D(videoTexture, vUv);

            if(vUv.y > ammoTime){
            
                gl_FragColor = vTexture;

            } else {
                 gl_FragColor = noAmmo;
            }

       
        }
        `;

    this.isTransitioning = false;

    this.orbMaterial = new THREE.ShaderMaterial( {

            // Set Render Texturew to Texture of Portla
            // Add a mask to give portal and elliptical shape
            uniforms: {
                videoTexture: {value: this.videoTexture},
                noAmmoTexture: {value: new THREE.TextureLoader().load("Assets/Models/player/outOfAmmo.png")},    
                ammoTime: {value: 0}
            },
        
            // Declare Vertex and Fragment Shader
            vertexShader: this.vertexShader,
            fragmentShader: this.fragmentShader,
            
            // Pervent Z fighting
            polygonOffset: true,
            polygonOffsetFactor: -20,

            uniformsNeedUpdate: true  
        
        } );
        this.orbTween = new TWEEN.Tween(this.orbMaterial.uniforms.ammoTime)

        //#region 


        //#region portalgun effect


        this.gunEffectFragment = `
        varying vec2 vUv;

        void main() {

            float dist = distance(vec2(vUv.x,vUv.y), vec2(0.5, 0.5));
            
            if(dist > 0.35){
                
                gl_FragColor = vec4(1,0,0,255);

            } else {
             
                discard;
            }

            if(dist > 0.4){
               discard;
            }

        
        }
        `;

        this.gunChargeEffectMat = new THREE.ShaderMaterial( {

            // Set Render Texturew to Texture of Portla
            // Add a mask to give portal and elliptical shape
            uniforms: {  
               
            },
        
            // Declare Vertex and Fragment Shader
            vertexShader: this.vertexShader,
            fragmentShader: this.gunEffectFragment,
            
            // Pervent Z fighting
            polygonOffset: true,
            polygonOffsetFactor: -20,

            uniformsNeedUpdate: true  
        
        } );
     
        // reticle text
        var fLoader2 = new FBXLoader();
        fLoader2.load("Assets/Models/player/wordRing.fbx", (object)=>
            {
                this.wordRing = object;

                var wDir = new THREE.Vector3();
                this._camera.getWorldDirection(wDir);

                this.wordRing.position.copy(this._camera.position.clone().add(wDir.clone().multiplyScalar(0.21)))
                this.wordRing.lookAt(this._camera.position);
                this.wordRing.scale.set(0.0002,0.0002,0.0002);
                this.wordRing.material = new THREE.MeshPhongMaterial( {transparent: true});
                
                this.wordRing.getObjectByName("Circle").material.transparent = true;
                this.wordRing.getObjectByName("Circle").material.map = this.destTexture;
                this.wordRing.getObjectByName("Circle").material.map.needsUpdate = true;

                scene.add(object);
            })

        this.loadGunModel();


        // preload mask textures
        this.maskTexture = new THREE.TextureLoader().load("Assets/Models/face/scaryMask.png")
        this.maskMap = new Map();
        var emotions = ["Kiss", "Smile", "Frown", "Pressed"];
        emotions.forEach((emotion)=>{
            this.maskMap.set(emotion, new THREE.TextureLoader().load((`Assets/Models/face/${emotion}.png`)))
        })
        
        this.snapshotMeshArray = [];

        document.addEventListener("actionAdded", (e)=>{
            this.maskTexture = this.maskMap.get(e.detail);



            var snapshotGeom = this.familiarMesh.geometry.clone();
            var snapshotMaterial = this.familiarMesh.material.clone();
            snapshotMaterial = this.createSnapShotMaterial(this.maskMap.get(e.detail));
            
            snapshotMaterial.needsUpdate = true;

            var snapshotMesh = new THREE.Mesh(snapshotGeom, snapshotMaterial);
            snapshotMesh.geometry.computeBoundingBox();
            snapshotMesh.geometry.center();

            snapshotGeom.rotateZ(Math.PI);


            this.familiarMesh.add(snapshotMesh);

            snapshotMesh.scale.set(0.025,0.025,0.025);
        
     
            snapshotMesh.position.copy(this.familiarMesh.position);

            scene.add(snapshotMesh);

            this.snapshotMeshArray.push(snapshotMesh);

        })


    }



    updateSnapshots()
    {
        var i = 0;
        this.snapshotMeshArray.forEach((snapshotMesh)=>{

            var wPos = new THREE.Vector3()
            this.gunModel.getObjectByName("Familiar").getWorldPosition(wPos);
            snapshotMesh.position.copy(this.familiarMesh.position.clone().sub(this.familiarMesh.userData.addTranslation).add(new THREE.Vector3(0,0.01*i-0.01,0)));
            i += 1;
            snapshotMesh.lookAt(this._camera.position)
        })
    }

    // simplex noise 2D by https://github.com/stegu/webgl-noise Ashima Arts and Stefan Gustavson
    createSnapShotMaterial(faceTexture){
        var snapshotVertex  = `
            varying vec4 vPos;
            varying vec4 testPos;
            uniform mat4 camProj;
            uniform mat4 viewMat;
            uniform mat4 model;
            varying vec2 vUv;
            void main() {
                // projectionMatrix
                vPos = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    
                gl_Position = vPos;
                vUv = uv;
                testPos = camProj * model * vec4( position, 1.0 );
    
            }
        `;
        var snapshotFragment = `
            varying vec4 vPos;
            varying vec4 testPos;
            uniform sampler2D faceTex;
            uniform float fadeTime;
            varying vec2 vUv;

            // Simplex 2D noise
            //
            vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

            float snoise(vec2 v){
            const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                    -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1;
            i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                dot(x12.zw,x12.zw)), 0.0);
            m = m*m ;
            m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
            }
    
        
            void main() {
                
                vec4 faceMaskCol = texture2D(faceTex, vUv); 
                
                if((snoise(vUv*3.0)+1.0)/2.0 > fadeTime){
                    gl_FragColor = vec4(faceMaskCol.xyz,1.0);
                } else if ((snoise(vUv*3.0)+1.0)/2.0 > fadeTime-0.05){
                    gl_FragColor = vec4(0.5,0,0,1.0);
                }
           
            }
            `;
    
        return new THREE.ShaderMaterial( {
    
            uniforms: {
                faceTex: {value: faceTexture}, 
                fadeTime: {value: 0},
            },
        
            // Declare Vertex and Fragment Shader
            vertexShader: snapshotVertex,
            fragmentShader: snapshotFragment,
            side: THREE.DoubleSide,
            transparent: true,
            uniformsNeedUpdate: true  
            
        
        } );
    }

    cleanSnapshots(){
        this.snapshotMeshArray.forEach(snapshotMesh =>{

            new TWEEN.Tween(snapshotMesh.material.uniforms.fadeTime).to({value: 1.0}, 500).easing(TWEEN.Easing.Cubic.InOut).start().onComplete(()=>{
            snapshotMesh.geometry.dispose();
            snapshotMesh.material.dispose();

            scene.remove(snapshotMesh);
            }
            )
          

        })
        this.snapshotMeshArray.length = 0;
    }


    async loadGunModel(){
        var fLoader = new FBXLoader();

        var loadedGunModel = await fLoader.loadAsync("Assets/Models/player/playerHands.fbx");
        await this.setupGunModel(loadedGunModel);
        await this.textureGunModel();
       
        console.log(this.gunModel)
      
        await scene.add(this.gunModel);
        this.gunModel.parent = this._camera;
    }

    async setupGunModel(res){
        

        res.position.set(0.02,-0.02,-0.13)
        
        var scale = 0.00025;
        res.scale.set(scale,scale,scale);
    
        // scene.add(object)
        var object = res;
        
        
        this.gunModel = object;

        this.chargeTween = new TWEEN.Tween(this.gunModel.getObjectByName("chargingEffect").scale);

        this.gunModel.getObjectByName("cameraOrb").material = this.orbMaterial;
    

        this.mixer = new THREE.AnimationMixer( object );
        this.animationsMap["flip"] = this.mixer.clipAction( object.animations[ 7 ] );
        this.animationsMap["flip"].loop = THREE.LoopOnce;

        this.animationsMap["startFlip"] = this.mixer.clipAction( object.animations[ 0 ] );
        this.animationsMap["startFlip"].clampWhenFinished = true;
        this.animationsMap["startFlip"].loop = THREE.LoopOnce;

        this.animationsMap["stopFlip"] = this.mixer.clipAction( object.animations[ 5 ] );
        this.animationsMap["stopFlip"].clampWhenFinished = true;
        this.animationsMap["stopFlip"].loop = THREE.LoopOnce;
        this.animationsMap["stopFlip"].setDuration(0.4);

        this.animationsMap["shoot"] = this.mixer.clipAction( object.animations[ 8 ] );
        this.animationsMap["shoot"].clampWhenFinished = true;
        this.animationsMap["shoot"].loop = THREE.LoopOnce;
    
        this.animationsMap["reloadArms"] = this.mixer.clipAction( object.animations[ 2 ] );
        this.animationsMap["reloadArms"].clampWhenFinished = true;
        this.animationsMap["reloadArms"].loop = THREE.LoopOnce;
        this.animationsMap["reloadArms"].setDuration(1.3);

        this.animationsMap["reloadOrb"] = this.mixer.clipAction( object.animations[ 4 ] );
        this.animationsMap["reloadOrb"].clampWhenFinished = true;
        this.animationsMap["reloadOrb"].loop = THREE.LoopOnce;
        this.animationsMap["reloadOrb"].setDuration(1.3);

        this.animationsMap["charge"] = this.mixer.clipAction( object.animations[ 3 ] );
        this.animationsMap["charge"].clampWhenFinished = true;
        this.animationsMap["charge"].loop = THREE.LoopOnce;
        this.animationsMap["charge"].setDuration(0.7);

        this.animationsMap["noAmmo"] = this.mixer.clipAction( object.animations[ 1 ] );
        this.animationsMap["noAmmo"].clampWhenFinished = true;
        this.animationsMap["noAmmo"].loop = THREE.LoopOnce;
        this.animationsMap["noAmmo"].setDuration(1.5);

        this.isSpinning = false;   
        this.gunModel.getObjectByName("chargingEffect").material = this.gunChargeEffectMat;

        this.mixer.timeScale = 1.5; // set timescale to help with speed of animation
        this.mixer.addEventListener("finished", (e) => {

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

                new TWEEN.Tween(this).to({reticleRotationZ: 0}, 500).easing(TWEEN.Easing.Cubic.InOut).start();
                this.clearDestinationText()

                
                this.chargeTween.to({x:0,y:0,z:0}, 100).easing(TWEEN.Easing.Cubic.In).start();
            }

            // FIX ME: MAKE SAME LENGTH ANIMATION

            if(e.action._clip.name == "cameraOrb|reload" && !this.animationsMap["reloadArms"].isRunning()){
                this.animationsMap["reloadOrb"].stop();
                this.animationsMap["reloadArms"].stop();
                this.animationsMap["flip"].stop();
                this.ammoCount = 1;

                this.chargeTween.to({x:0,y:0,z:0}, 100).easing(TWEEN.Easing.Cubic.In).start();
                
            }

            if(e.action._clip.name == "arm|reload.001" && !this.animationsMap["reloadOrb"].isRunning()){
                this.animationsMap["reloadArms"].stop();
                this.animationsMap["reloadOrb"].stop();
                this.animationsMap["flip"].stop();
                this.ammoCount = 1;

                this.chargeTween.to({x:0,y:0,z:0}, 100).easing(TWEEN.Easing.Cubic.In).start();
            
            }

            if(e.action._clip.name == "arm|spin"){
            
                this.animationsMap["stopFlip"].play();
                this.isSpinning = false;
            }

            if(e.action._clip.name == "arm|noAmmo"){

                this.animationsMap["noAmmo"].reset().stop();
                
                this.chargeTween.to({x:0,y:0,z:0}, 100).easing(TWEEN.Easing.Cubic.In).start();
                this.cleanSnapshots();
            }

            if(e.action._clip.name == "arm|charge"){

                this.isCharged = true;
                scene.userData.changingScene = true;


                if(!this.chargeTween.isPlaying()){
                    this.chargeTween.to({x:20,y:20,z:20}, 1000).easing(TWEEN.Easing.Cubic.In).start();
                }
                
                
            } 
        })

    

        this.gunModel.children.forEach(child => {
                child.renderOrder = -1
                //child.frustumCulled = false;
            }
        )

    }

    initializeFamilliar(){
          //#region familiar
            //this.familiarMesh = new THREE.Mesh(new THREE.SphereGeometry(0.007, 32, 16 ), new THREE.MeshPhongMaterial());
            
             // FIXME: DO PROPER ASYNC
            this.familiarMesh = scene.userData.faceMesh;

            this.familiarMesh.scale.set(0.05,0.05,0.05);
            this.familiarMesh.material.map = this.maskTexture;


            this.familiarMesh.userData.relativePos = new THREE.Vector3(0,0,0);
            this.familiarMesh.userData.velocity = new THREE.Vector3(0,0,0);
            this.familiarMesh.userData.addTranslation = new THREE.Vector3(0,0,0);

 

             new TWEEN.Tween(this.familiarMesh.userData.addTranslation)
             .to({y:0.015}, 1000)
             .yoyo(true)
             .easing(TWEEN.Easing.Sinusoidal.InOut)
             .repeat(Infinity)
             .start()
        
            scene.add(this.familiarMesh);

            this.familiarMesh.userData.positions = {
                cur: new THREE.Vector3(),
                target: new THREE.Vector3()
            }
           
            this.gunModel.getObjectByName("Familiar").getWorldPosition(this.familiarMesh.userData.positions.cur);
            this.gunModel.getObjectByName("Familiar").getWorldPosition(this.familiarMesh.userData.positions.target);
            this.gunModel.getObjectByName("Familiar").getWorldPosition(this.familiarMesh.position);



            //#endregion

            document.addEventListener("teleport",(e)=>{
                this.teleporting = true;
                
                //this.updateFamiliar();
                this.gunModel.getObjectByName("Familiar").getWorldPosition(this.familiarMesh.userData.positions.target);
                this.familiarMesh.userData.positions.target = this.familiarMesh.userData.positions.target.clone().sub(scene.userData._preTeleportDeltaTranslate);
                this.familiarMesh.userData.positions.cur = this.familiarMesh.userData.positions.target.clone().add(this.familiarMesh.userData.relativePos);
               
                this.teleporting = false;
            });
        
        
    }

    updateFamiliar(){
        


        // move to initialize initialize Facemesh
        if(Object.hasOwn(scene.userData,"faceMesh") && this.gunModel && !this.teleporting){
            if (this.familiarMesh != scene.userData.faceMesh){
                this.initializeFamilliar();    
            } else {

          
            
            this._camera.updateWorldMatrix(true,true); // important for objects that are linked to camera

            //this.familiarMesh.userData.positions.cur = new THREE.Vector3().lerpVectors(this.familiarMesh.userData.positions.cur, this.familiarMesh.userData.positions.target, 0.1);

            var newTarget = new THREE.Vector3();
            this.gunModel.getObjectByName("Familiar").getWorldPosition(newTarget);

            var distanceBetween = newTarget.distanceTo(this.familiarMesh.userData.positions.target);

            //this.familiarMesh.userData.velocity = new THREE.Vector3(0,0,0);

            var toTargetNorm = newTarget.clone().sub(this.familiarMesh.userData.positions.cur).normalize();
            this.familiarMesh.userData.velocity = new THREE.Vector3(0,0,0);
        
            //this.familiarMesh.userData.velocity = this.familiarMesh.userData.velocity.clone().add(toTargetNorm.clone().multiplyScalar(-0.2));
            this.familiarMesh.userData.velocity = toTargetNorm.clone().multiplyScalar(-0.1).multiplyScalar(distanceBetween);
            this.familiarMesh.userData.relativePos = this.familiarMesh.userData.velocity.clone().multiplyScalar(scene.userData.globalDelta).add(this.familiarMesh.userData.relativePos).clampLength(0,0.03); // use delta time?

            this.familiarMesh.userData.relativePos = new THREE.Vector3().lerpVectors(this.familiarMesh.userData.relativePos, new THREE.Vector3(0,0,0), 0.1)
            this.familiarMesh.userData.positions.cur = newTarget.clone().add(this.familiarMesh.userData.relativePos);

            // var toNewTargetNorm = this.familiarMesh.userData.positions.target.clone().sub(this.familiarMesh.userData.positions.cur).normalize();
            // if(distanceTo > distanceToOldTarget){
            //     this.familiarMesh.userData.positions.cur = newTarget.clone().sub(toTargetNorm.clone().multiplyScalar(0.05));
            // }
            
            // if(distanceTo >= 0.05){
            //     //this.familiarMesh.userData.positions.cur = newTarget.clone().sub(toTargetNorm.clone().multiplyScalar(0.05));


            //     this.familiarMesh.userData.positions.cur = newTarget;

            // }

            //this.familiarMesh.userData.positions.cur = this.SuperSmoothLerp(this.familiarMesh.userData.positions.cur,this.familiarMesh.userData.positions.target,newTarget,scene.userData.globalDelta, 0.8);

            this.familiarMesh.userData.positions.target.copy(newTarget); 

            this.familiarMesh.material.map = this.maskTexture;
            this.familiarMesh.material.map.needsUpdate = true;
            
            this.familiarMesh.position.copy(this.familiarMesh.userData.positions.cur.clone().add(this.familiarMesh.userData.addTranslation));

           this.familiarMesh.lookAt(this._camera.position);
        
            this._camera.updateWorldMatrix(true,true); // important for objects that are linked to camera

            // this.familiarMesh.updateMatrix();
            // this.familiarMesh.updateWorldMatrix(true,true);
            // this.familiarMesh.updateMatrixWorld(true);

            this.updateSnapshots()

            }
        }
    }

    

    updateDestinationText(){
        var destinationText = scene.userData.destinationTheme;
        var ctx = this.canvasDestination.getContext("2d");
        ctx.clearRect(0,0,this.canvasDestination.width,this.canvasDestination.height);
        var textWidth = ctx.measureText(destinationText).width;

        ctx.font = "70px Comic Sans MS";
        ctx.lineWidth = 3; 
   
    
        // scale text if its too long
        if(textWidth > this.canvasDestination.width){
    
            ctx.font = `${ (this.canvasDestination.width / textWidth)* 70}px Comic Sans MS`;
            ctx.lineWidth = (this.canvasDestination.width / textWidth)*3; 
            textWidth = ctx.measureText(destinationText).width;
    
        } 
 
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black'
        ctx.fillText(destinationText, (this.canvasDestination.width/2) - (textWidth/2), (this.canvasDestination.height/2)+25);
        ctx.strokeText(destinationText, (this.canvasDestination.width/2) - (textWidth/2), (this.canvasDestination.height/2)+25);

        if(this.wordRing){
            this.wordRing.getObjectByName("Circle").material.transparent = true;
            this.wordRing.getObjectByName("Circle").material.map = this.destTexture;
            this.wordRing.getObjectByName("Circle").material.map.needsUpdate = true;
        }
        
  
    }

    clearDestinationText(){
        this.canvasDestination.getContext("2d").clearRect(0,0,this.canvasDestination.width,this.canvasDestination.height);
    }

    textureGunModel(){

        this.gunModel.getObjectByName("gun").traverse((obj)=>
            {
                if(obj.type == "Mesh"){
                    if(obj.material.length > 0){
                        obj.material.forEach((mat)=>{
                            mat.map = new THREE.TextureLoader().load("Assets/Models/player/gunColor.png");
                            mat.color.setRGB(1,1,1);
                            mat.map.needsUpdate = true;
                            mat.needsUpdate = true;

                        })
                    }
                }
            
            }
            )
        
           
    }

    update(){

        if(this.gunModel){

        if(Object.hasOwn(scene.userData, "faceMesh")){
            this.updateFamiliar()
        }

       if(scene.userData.changingScene){
            this.updateDestinationText();
       } 

        var wDir = new THREE.Vector3();
        this._camera.getWorldDirection(wDir);

        this.reticle.position.copy(this._camera.position.clone().add(wDir.clone().multiplyScalar(0.21)))
        this.reticle.lookAt(this._camera.position);

        if(this.wordRing){
            this.wordRing.position.copy(this._camera.position.clone().add(wDir.clone().multiplyScalar(0.21)))
            this.wordRing.lookAt(this._camera.position);
            this.wordRing.scale.set(0.0002,0.0002,0.0002);
        }

        if(this.ammoCount == 0){
            if(!this.isTransitioning && this.orbMaterial.uniforms.ammoTime.value != 1){
                this.orbTween.to({value: 1},1000)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start().onComplete(()=>{this.isTransitioning = false})

                this.isTransitioning = true;
            }

        } else {
            if(!this.isTransitioning && this.orbMaterial.uniforms.ammoTime.value != 0){
                this.orbTween.to({value: 0},500)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start().onComplete(()=>{this.isTransitioning = false})

                this.isTransitioning = true;
            }


        }

        if(this._cooldownTimer.getElapsedTime() >= this._cooldown && this.ammoCount != 0){
            this._checkFire();
        } else {
            if (inputController._current.leftButton && inputController._previous?.leftButton && !this.animationsMap["shoot"].isRunning() && !this.animationsMap["stopFlip"].isRunning()  && !this.animationsMap["reloadOrb"].isRunning() && !this.animationsMap["reloadArms"].isRunning()) {
                
                if(this.animationsMap["flip"].isRunning()){
                    this.animationsMap["flip"].stop();
                    this.isSpinning = false;
                }
                this.animationsMap["noAmmo"].play();
                
            }
        }

     
        this.reticle.rotateZ(this.reticleRotationZ);

        TWEEN.update();
        if(this.portalTest){
            this.portalTest._updatePortal();
        }
        if(this.outPortal){
            this.outPortal._updatePortal();
        }

  
        this.mixer.update(scene.userData.globalDelta) // FIXME MAKE SURE MIXER IS INITIALIZED

        if(!this.animationsMap["noAmmo"].isRunning() && !this.animationsMap["charge"].isRunning() && !scene.userData.changingScene){


        // allow to reload whenever && this.ammoCount == 0
        if(inputController._keys["82"]  && !this.animationsMap["shoot"].isRunning() && !this.animationsMap["stopFlip"].isRunning()  && !this.animationsMap["reloadOrb"].isRunning() && !this.animationsMap["reloadArms"].isRunning()){
            
            this.animationsMap["startFlip"].stop(); 
            this.animationsMap["flip"].loop = THREE.LoopOnce;
            // check if spinning complete spin
            
            if(!this.animationsMap["flip"].isRunning()){
                this._reload();
            }
        }

   

        else if(!scene.userData.changingScene && inputController._keys["70"] && !this.animationsMap["charge"].isRunning() && !this.animationsMap["shoot"].isRunning() && !this.animationsMap["reloadOrb"].isRunning() && !this.animationsMap["reloadArms"].isRunning() && !this.animationsMap["stopFlip"].isRunning()){
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
            } 
        }
        this._checkJumpAnimation();
    }

    }

    _checkJumpAnimation(){
        

       // this.gunModel.setRotationFromEuler(new THREE.Euler().set(0.5*(this.FPSController._translation.y-this.FPSController._groundPosition.y)/62,0,0));

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
            this.animationsMap["startFlip"].play();
        } else {
            this.animationsMap["flip"].loop = THREE.LoopRepeat;
        }
    }

    _checkFire(){
        // check cooldown
        if(!inputController._current.leftButton && inputController._previous?.leftButton && this.isCharged){
            
            if(scene.userData.curRoom._curTheme != scene.userData.destinationTheme){
                this._cooldown = 0.5;
                this._cooldownTimer.stop();

                document.dispatchEvent(this._fireEvent)
                this.ammoCount -= 1;
                this.isCharged = false;

                this._cooldownTimer.start();
                this.animationsMap["charge"].reset().stop();
            } else {
                this.animationsMap["noAmmo"].play();
                this.animationsMap["charge"].reset().stop();
                scene.userData.changingScene = false;
                actionList.length = 0;
            }



        } else if (inputController._current.leftButton && inputController._previous?.leftButton) {
            
            if(this.animationsMap["flip"].isRunning()){
                this.animationsMap["flip"].stop();
                this.isSpinning = false;
               
            }
            
            this.animationsMap["charge"].play();

            this.reticleRotationZ -= scene.userData.globalDelta*4;

        } else {
            this.animationsMap["charge"].stop();
            this.isCharged = false;
        }
    }


    //#region Protal Calculations

    _calculateExitPortalPosition(){
       
        var destinationRoom = scene.userData.destinationRoom;
        var curRoom = scene.userData.curRoom;
        
        var roomSizeRatio = destinationRoom._size.length() / curRoom._size.length();
        
        // calculate position 
        var curPortalPosFromCenter = this.portalTest._portal.position.clone().sub(curRoom._center); // the current position of the portal from the roomCenter
        var newPortalPosFromCenter = curPortalPosFromCenter.clone().multiplyScalar(roomSizeRatio); // the position of the portal in the other room
        newPortalPosFromCenter = newPortalPosFromCenter.reflect(this.portalNormal); // reflect the portal position to be on the opposite side of the destination room

        this.secondPortalPos = newPortalPosFromCenter.clone().add(destinationRoom._center);


        const raycaster = new THREE.Raycaster(); // intialize raycaster 
        raycaster.set(destinationRoom._center, newPortalPosFromCenter.clone().normalize());
        var outHit = raycaster.intersectObjects(scene.userData.portalableSurfaces)[0] // check if raycaster intersect any of the surfaces


        if(this.outPortal){
            this.outPortal._removePortal();
        }

        this.outPortal = new Portal(this._camera); // create exit portal
        var exitPortal = new THREE.Mesh(this.portalTest.portalGeom.clone(), this.portalMaterial);

        exitPortal.recieveShadow = true;

        exitPortal.position.copy(outHit.point) 
                
        var n = outHit.face.normal.clone();
        this.outPortal.normal = n.clone();

        n.transformDirection(outHit.object.matrixWorld);
        n.add(exitPortal.position);


        
        var wDir = new THREE.Vector3();
        this._camera.getWorldDirection(wDir)

        

        exitPortal.up.copy(wDir.multiplyScalar((this.outPortal.normal.clone().dot(THREE.Object3D.DefaultUp.clone()))).add(THREE.Object3D.DefaultUp)) /// redo this research how rto do projection // THREE.Object3D.DefaultUp
        exitPortal.lookAt(n);
  
        this.outPortal._placePortal(outHit, exitPortal);
 

        this.outPortal.linkPortal(this.portalTest._portal.position)

        scene.userData.outPortal = this.outPortal;
        


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

        // decal placement code adapated from https://www.youtube.com/watch?v=ZSTgk7JT668&ab_channel=SimonDev 
        const position = hits[0].point.clone(); // set position to the closest hit
        const eye = position.clone();
        eye.add(hits[0].face.normal);

        const rotation = new THREE.Matrix4();

        var wDir = new THREE.Vector3();
        this._camera.getWorldDirection(wDir)

        var normal = hits[0].face.normal;

        this.portalNormal = normal;

        rotation.lookAt(eye, position, THREE.Object3D.DefaultUp); // default_up

        const euler = new THREE.Euler();
        euler.setFromRotationMatrix(rotation);

        if(this.portalTest){
            this.portalTest._removePortal(); // clean up previous portal if it exist
        }

        this.portalTest = new Portal(this._camera); // create entry portal
        this.portalTest.normal = normal;
        scene.userData.inPortal = this.portalTest;

        var newPortal = new THREE.Mesh(this.portalTest.portalGeom, this.portalMaterial);
        newPortal.recieveShadow = true;

        newPortal.position.copy(hits[0].point) 
                
        var n = normal.clone();
        n.transformDirection(hits[0].object.matrixWorld);
        n.add(newPortal.position);

        newPortal.up.copy(wDir.multiplyScalar((normal.clone().dot(THREE.Object3D.DefaultUp))).add(THREE.Object3D.DefaultUp)) /// redo this research how rto do projection // THREE.Object3D.DefaultUp
        newPortal.lookAt(n);

        const hit = hits[0]
        this.portalTest._placePortal(hit, newPortal);
        

        this._calculateExitPortalPosition(); // calculate position of exit portal
        this.outPortal.position = this.secondPortalPos;  
            
        this.portalTest.linkPortal(this.outPortal._portal.position);

    }
    //#endregion


}