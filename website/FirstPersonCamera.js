import * as InputController from "./InputController.js"
import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';
import { DecalGeometry } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/geometries/DecalGeometry.js';

export class FirstPersonCamera{
    constructor(camera, roomBounds, room, scene, renderer, roomBounds2, room2, curRoom, portalRoom){
        this._camera = camera;
        this._input = new InputController.InputController();
        this._rotation = new THREE.Quaternion();
        this._translation = camera.position.clone();
        this._roomBounds = roomBounds;
        this._surfaces = room.surfaces;
        this._surfaces2 = room2.surfaces;
        this._scene = scene;
        this._renderer = renderer;


        this.curRoom = curRoom;
        this.portalRoom = portalRoom;

        
        this._groundPosition = new THREE.Vector3(0,10,0);

        this._phi = 0;
        this._theta = 0;


        // for vertical movement
        this._verticalVelocity = 0;
        this._gravity = 5;
        this._jumpHeight = 0.5;
        this._isGrounded = true; 

        this._fireEvent = new Event("fire");
        document.addEventListener("fire", this._updateDecals.bind(this)); // research about this
        document.addEventListener("fire", ()=>{console.log("fired")});

        this._cooldownTimer = new THREE.Clock();
        this._cooldown = 0;


        this.renderTarget = new THREE.WebGLRenderTarget( 1024, 1024);
        this.portalCamera = new THREE.PerspectiveCamera( 45, this._camera.aspect, 1, 2000 );
        
        
        this.center2 = new THREE.Vector3();
        roomBounds2.getCenter(this.center2);

        this._roomBounds2 = roomBounds2;
        
        this.portalCamera.position.copy(this.center2);

        this.portalGeom = new THREE.PlaneGeometry(40,40);
        this.portalObj;


        // https://discourse.threejs.org/t/getting-screen-coords-in-shadermaterial-shaders/23783/2

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
    uniform sampler2D renderTexture;
    uniform sampler2D portalMask;

    varying vec2 vUv;

  
  void main() {

     

  	    vec2 vCoords = vPos.xy;

        

		vCoords /= vPos.w;
  
    
		vCoords = vCoords * 0.5 + 0.5;
  
    vec2 suv = vCoords;
    //gl_FragColor = vec4( uv, 0.0, 1.0 );
    
    vec4 pMask = texture2D(portalMask,vUv);
    vec4 portal = texture2D(renderTexture, suv);

    vec4 maskedPortal = vec4(portal.x,portal.y,portal.z,portal.w);
    
    if(pMask.x == 1.0){
        discard;
    }

    gl_FragColor = maskedPortal;
  }
`;

  

          
this.portalCamera.updateProjectionMatrix();
this.clippingPlane = new THREE.Plane();

this.portalMaterial = new THREE.ShaderMaterial( {

        uniforms: {
            portalMask: {value: new THREE.TextureLoader().load("./portalMask.png")},
            renderTexture: {value: this.renderTarget.texture},
            camProj: {
                
                type:"mat4",
                value : [this.portalCamera.projectionMatrix]},

                viewMat: { 
                    
                    type:"mat4",
                    value: [this.portalCamera.matrixWorldInverse] },
            
                model: {
                    
                    type:"mat4",
                    value: [this.portalCamera.matrixWorldInverse]}

         
        },
       
    
        vertexShader: this.vertexShader,
        fragmentShader: this.fragmentShader,

        transparent: false,
        depthTest: true,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -4,
    
    } );

    this.portalMaterial.uniformsNeedUpdate = true;





        
    }

    update(delta){
    
        if(!(document.pointerLockElement===null)){
            this._updateRotation(delta);
         
        
            

            if(this._cooldownTimer.getElapsedTime() >= this._cooldown){
                this._checkFire();
            }

            this._input.update(delta);


            this._updateCamera(delta);
            if(this._portal){
                this._updatePortal();
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
        this._camera.updateWorldMatrix(true,true);
    }

    _updatePortal(){
        //this.portalCamera.position.copy(this._camera.position);
        //this.portalCamera.rotation.copy(this._camera.rotation);

          // set the portal position in other room

        var roomSize = new THREE.Vector3();
        this._roomBounds.getSize(roomSize);

        var curRoomCenter = new THREE.Vector3();
        this._roomBounds.getCenter(curRoomCenter);


        var portalFromCenter = this._portal.position.clone().add(new THREE.Vector3(0,-10,0)).sub(curRoomCenter);
        var modifiedPortalFromCenter = this._portal.position.clone().add(new THREE.Vector3().multiplyVectors(this.portalNormal,  roomSize)).add(new THREE.Vector3(0,-10,0)).sub(curRoomCenter);

        var posFromPortal = this._camera.position.clone().sub(this._portal.position.clone().add(new THREE.Vector3(0,-10,0)));
        var camPosFromPortal = posFromPortal //.multiplyScalar(-1) //.add(new THREE.Vector3()) //0,roomSize.y,0
        var portalPos = this.center2.clone().add(modifiedPortalFromCenter);


     

       // this._camera.rotation

       ///  WORKING VALUES AS POSITON IS SET CORRECTLY
       // ----------------------------------
       //this.portalCamera.position.copy(this._camera.clone().position.add(new THREE.Vector3(0,roomSize.y,0)).add(new THREE.Vector3(0,10,0)));
       
     
       //.sub(new THREE.Vector3(-this.portalNormal.x*roomSize.x/2,-this.portalNormal.y*roomSize.y/2-10,-this.portalNormal.z*roomSize.z/2)
       
       this.portalCamera.position.copy(camPosFromPortal.add(portalPos))

      // var obliqueClipPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.portalNormal, portalPos.add(this.portalNormal.multiplyScalar(1)));


       
       this.portalCamera.rotation.copy(new THREE.Euler().setFromVector3(new THREE.Vector3(this._camera.rotation.x, this._camera.rotation.y,this._camera.rotation.z)));

       
       // ----------------------------------
       


       
       // set portal camera rotaion


  
        var portalLookAt = this._portal.position.clone().sub(this._camera.position);

       



        this.portalCamera.near = this._camera.position.clone().distanceTo(this._portal.position.clone().add(new THREE.Vector3(0,-10,0)))*0.5;
        this.portalCamera.updateProjectionMatrix();

        this.portalMaterial.uniforms.renderTexture.value = this.renderTarget.texture;
        this.portalMaterial.uniforms.camProj.value = this.portalCamera.projectionMatrix;
        this.portalMaterial.uniforms.viewMat.value = this.portalCamera.matrixWorldInverse
        this.portalMaterial.uniforms.model.value = this._portal.modelViewMatrix.elements

        this._renderer.setRenderTarget(this.renderTarget);



        
        this.portalMaterial.uniformsNeedUpdate = true;
       
        this._renderer.render(this._scene, this.portalCamera);


       

        this._renderer.setRenderTarget(null);


    }

    _updateDecals(){
      
        this._scene.remove(this._portal);

        const raycaster = new THREE.Raycaster();
        const pos = {x:0,y:0};

        raycaster.setFromCamera(pos, this._camera);
        const hits = raycaster.intersectObjects(this._surfaces);

        if(!hits.length){
            return;
        }


       

        const position = hits[0].point.clone();
        const eye = position.clone();
        eye.add(hits[0].face.normal);

        const rotation = new THREE.Matrix4();

        var wDir = new THREE.Vector3();
        this._camera.getWorldDirection(wDir)

        var normal = hits[0].face.normal;

        this.portalNormal = normal;
     
        //wDir.multiplyScalar(THREE.Object3D.DefaultUp.clone().dot(normal))

        rotation.lookAt(eye, position, THREE.Object3D.DefaultUp);
        const euler = new THREE.Euler();
        euler.setFromRotationMatrix(rotation);
        //euler.setFromVector3(normal);

        // const decalGeometry = new DecalGeometry(

        //     hits[0].object, hits[0].point.add(new THREE.Vector3(0,10,0)), euler, new THREE.Vector3(30,30,30)


        // )
        
    


        const loader = new THREE.TextureLoader();

        // const video = document.getElementById( 'video' );
        // const texture = new THREE.VideoTexture( video )
        


        
    

    

        const decalMaterial = new THREE.MeshStandardMaterial({
            //map: loader.load("./portalMask.png"),
            map: this.renderTarget.texture,
            transparent: false,
            depthTest: true,
            depthWrite: true,
            polygonOffset: true,
            polygonOffsetFactor: -4,
        })

        // var stencilRef = 1;

        // decalMaterial.stencilWrite = true;
        // decalMaterial.stencilRef = stencilRef;
        // decalMaterial.stencilFunc = THREE.AlwaysStencilFunc;
        // decalMaterial.stencilZPass = THREE.ReplaceStencilOp;
        // decalMaterial.depthWrite = false;

        var newPortal = new THREE.Mesh(this.portalGeom, this.portalMaterial);
        newPortal.recieveShadow = true;

        
        newPortal.position.copy(hits[0].point) // use copy to copy to
        
        
        const n = normal.clone();
        n.transformDirection(hits[0].object.matrixWorld);
        n.add(newPortal.position);




        newPortal.up.copy(wDir.multiplyScalar((normal.clone().dot(THREE.Object3D.DefaultUp))).add(THREE.Object3D.DefaultUp)) /// redo this research how rto do projection



        newPortal.lookAt(n);



        const hit = hits[0]
        
        this._portal = newPortal;
        this._portal.userData.bounds = new THREE.Box3().setFromObject(newPortal , true);
        this._portal.userData.bounds.min = new THREE.Vector3(Math.round(this._portal.userData.bounds.min.x*10)/10, Math.round(this._portal.userData.bounds.min.y*10)/10, Math.round(this._portal.userData.bounds.min.z*10)/10);
        this._portal.userData.bounds.max = new THREE.Vector3(Math.round(this._portal.userData.bounds.max.x*10)/10, Math.round(this._portal.userData.bounds.max.y*10)/10, Math.round(this._portal.userData.bounds.max.z*10)/10)



        console.log(hit.object.userData.bounds);
        console.log(this._portal.userData.bounds);

        var portalBounds = this._portal.userData.bounds;
        var portalSize = new THREE.Vector3();
        portalBounds.getSize(portalSize);


        console.log(hit.object.userData.bounds.containsBox(this._portal.userData.bounds) )
        if(!hit.object.userData.bounds.containsBox(this._portal.userData.bounds)){

            if(!hit.object.userData.bounds.containsPoint(this._portal.userData.bounds.min)){
                var portalMinBounds = this._portal.userData.bounds.min;
                var hitMinBounds = hit.object.userData.bounds.min;

                console.log(this._portal);
             
                
                if(portalMinBounds.x < hitMinBounds.x){
                    this._portal.position.x = hitMinBounds.x+portalSize.x/2;
                } 

                if(portalMinBounds.y < hitMinBounds.y){
                    this._portal.position.y = hitMinBounds.y+portalSize.y/2;
                } 
                if(portalMinBounds.z < hitMinBounds.z){
                    this._portal.position.z = hitMinBounds.z+portalSize.z/2;
                } 

            }
            if(!hit.object.userData.bounds.containsPoint(this._portal.userData.bounds.max)){

                var portalMaxBounds = this._portal.userData.bounds.max;
                var hitMaxBounds = hit.object.userData.bounds.max;

                console.log(this._portal);
             
                
                if(portalMaxBounds.x > hitMaxBounds.x){
                    this._portal.position.x = hitMaxBounds.x - portalSize.x/2;
                } 

                if(portalMaxBounds.y > hitMaxBounds.y){
                    this._portal.position.y = hitMaxBounds.y - portalSize.y/2;
                } 
                if(portalMaxBounds.z > hitMaxBounds.z){
                    this._portal.position.z = hitMaxBounds.z - portalSize.z/2;
                } 

            }

            this._portal.userData.bounds = new THREE.Box3().setFromObject(newPortal , true);
            this._portal.userData.bounds.min = new THREE.Vector3(Math.round(this._portal.userData.bounds.min.x*10)/10, Math.round(this._portal.userData.bounds.min.y*10)/10, Math.round(this._portal.userData.bounds.min.z*10)/10);
            this._portal.userData.bounds.max = new THREE.Vector3(Math.round(this._portal.userData.bounds.max.x*10)/10, Math.round(this._portal.userData.bounds.max.y*10)/10, Math.round(this._portal.userData.bounds.max.z*10)/10)
            
        }

        var roomSize = new THREE.Vector3();
        this._roomBounds.getSize(roomSize);


    
        

        this._scene.add(this._portal);
        
            

        
    }

    _updateTranslation(delta){

        
        if(this._translation.y > this._groundPosition.y){
            this._verticalVelocity -= this._gravity * delta;
            
        } else {
            this._translation.y = this._groundPosition.y
            this._verticalVelocity = 0;
            this._isGrounded = true;
        }

        if(this._input._keys["32"] && this._isGrounded){
            this._verticalVelocity += Math.sqrt(this._jumpHeight * 2 * this._gravity);
            this._isGrounded = false;
        }

        const forwardV = ((this._input._keys["87"] ? 1 : 0) + (this._input._keys["83"] ? -1 : 0))*100;
        const strafeV = ((this._input._keys["65"] ? 1 : 0) + (this._input._keys["68"] ? -1 : 0))*100;

        const qx = new THREE.Quaternion();
        qx.setFromAxisAngle(new THREE.Vector3(0,1,0), this._phi);

        const forward = new THREE.Vector3(0,0,-1);
        forward.applyQuaternion(qx);
        forward.multiplyScalar(forwardV*delta);

        const left = new THREE.Vector3(-1,0,0);
        left.applyQuaternion(qx);
        left.multiplyScalar(strafeV*delta);


        const up = new THREE.Vector3(0,1,0);
        up.multiplyScalar(this._verticalVelocity);

        var testTranslation = new THREE.Vector3().copy(this._translation);
        
        testTranslation.add(forward);
        testTranslation.add(left);
        testTranslation.add(up);

        

        //var sphereCollider = new THREE.Sphere(testTranslation, 9);
        var smallBox = this._roomBounds.clone();
        smallBox.expandByScalar(-0.2);


        if(smallBox.containsPoint(testTranslation)){
            this._translation.copy(testTranslation);
        } 
        
        if(!smallBox.containsPoint(testTranslation) || this._isGrounded) {

            if(this._portal){
                var pBounds = this._portal.userData.bounds.clone();
       
                // check if collides with portal
                pBounds.expandByVector(new THREE.Vector3(Math.abs(this.portalNormal.x), Math.abs(this.portalNormal.y)*10/3, Math.abs(this.portalNormal.z)).multiplyScalar(3))
                //pBounds.translate(this.portalNormal.clone().multiplyScalar(-3/2))
              
                    if (pBounds.containsPoint(testTranslation)){

                        // check if collides with room

                        console.log("collides portal")

                        var newRBounds = this._roomBounds2.clone();

                        var newPosCamera = this.portalCamera.position.clone().add(testTranslation.clone().sub(this._translation));
                        //.add(new THREE.Vector3().multiplyVectors(new THREE.Vector3(0,this.portalNormal.y,0).normalize(),new THREE.Vector3(0,2*this._gravity,0)))

                        if(this.portalNormal.y > 0){
                            this._groundPosition = new THREE.Vector3(0,0,0);
                        }


                        if(newRBounds.containsPoint(newPosCamera)){
                 
                            this._translation = this.portalCamera.position.clone().add(testTranslation.clone().sub(this._translation));
            
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
        

                    }
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