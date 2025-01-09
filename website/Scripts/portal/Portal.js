// class for oneway Portal

import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';
import {scene, renderer} from './../../main.js';
import { TWEEN } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/libs/tween.module.min.js';

export class Portal{

    constructor(playerCamera, secondPortalPos){
        
        this._playerCamera = playerCamera;

        // intialize renderTarget for the portal
        this.renderTarget = new THREE.WebGLRenderTarget( window.innerWidth,window.innerHeight);
        this.portalCamera = new THREE.PerspectiveCamera( this._playerCamera.fov, this._playerCamera.aspect, 1, 2000 ); // make sure to scale when resizing 
        
        this.portalGeom = new THREE.PlaneGeometry(40,40);
        this.normal;
        this.isOpen = false;

        // Used Tutorial to create Screen Space coords for portal shader https://discourse.threejs.org/t/getting-screen-coords-in-shadermaterial-shaders/23783/2

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
            uniform float portalOpeningTime;
            uniform float time;

            varying vec2 vUv;
            

        
            void main() {
                vec2 vCoords = vPos.xy;
                vCoords /= vPos.w;
                vCoords = vCoords * 0.5 + 0.5;
                vec2 suv = vCoords;
                
                vec4 pMask = texture2D(portalMask,(vUv-0.5)*(portalOpeningTime-2.0f)+0.5f);
                vec4 portal = texture2D(renderTexture, suv);

                vec4 maskedPortal = vec4(portal.x,portal.y,portal.z,portal.w);


                // https://godotshaders.com/shader/simple-ellipse-shader/

                float width = 15.f;
                float height = 20.f;

                float shrink_width = 2.0 / width;
                float shrink_height = 2.0 / height;
                float dist = distance(vec2(vUv.x * shrink_width, vUv.y * shrink_height), vec2(0.5 * shrink_width, 0.5 * shrink_height));
                
                vec2 vFromCenter = vec2(vUv.x * shrink_width, vUv.y * shrink_height) - vec2(0.5 * shrink_width, 0.5 * shrink_height);
                vec2 shrinkUV = vec2(vUv.x * shrink_width, vUv.y * shrink_height);
               

                if(dist > (portalOpeningTime / (26.f + 10.f*(dist*sin(time*10.f))))){
                    
                    gl_FragColor = vec4(1,0,0,255);

                } else {
                 
                    gl_FragColor = maskedPortal;
                }

                if(dist > portalOpeningTime / (25.f - 4.f*(vFromCenter.x*cos(vUv.y*250.f+portalOpeningTime+time*10.f)+vFromCenter.y*sin(vUv.x*250.f+portalOpeningTime+time*10.f))) &&  portalOpeningTime / 26.f < dist){
                   discard;
                }

            
            }
            `;
        this.portalMaterial = new THREE.ShaderMaterial( {

                // Set Render Texturew to Texture of Portla
                // Add a mask to give portal and elliptical shape
                uniforms: {
                    portalMask: {value: scene.userData.portalMask}, // preload image in scene
                    renderTexture: {value: this.renderTarget.texture},
                    portalOpeningTime: {value: 0},
                    time: {value: scene.userData.globalTime}
                },
            
                // Declare Vertex and Fragment Shader
                vertexShader: this.vertexShader,
                fragmentShader: this.fragmentShader,
                
                // Pervent Z fighting
                polygonOffset: true,
                polygonOffsetFactor: -1000,
               // polygonOffsetFactor: 10, 


                uniformsNeedUpdate: true  
            
            } );

        //#endregion

        window.addEventListener("resize", this.onWindowResize.bind(this), false);

        this._portal = new THREE.Mesh(this.portalGeom, this.portalMaterial);


        // portal transform 
        this.secondPortalPos = secondPortalPos;
        
    }

    _placePortal(hit, inPortalTransform){
        this._placePortalOnSurface(hit,inPortalTransform);
        scene.add(this._portal);

        new TWEEN.Tween(this.portalMaterial.uniforms.portalOpeningTime).to({value: 1},1000)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start().onComplete(()=>{this.isOpen=true;})
    }

    _placePortalOnSurface(hit, newPortal){

        this._portal.position.copy(newPortal.position);
        this._portal.rotation.copy(newPortal.rotation);
        
        this._portal.userData.bounds = new THREE.Box3().setFromObject(newPortal , true);

        this._portal.userData.bounds.min = new THREE.Vector3(Math.round(this._portal.userData.bounds.min.x*10)/10, Math.round(this._portal.userData.bounds.min.y*10)/10, Math.round(this._portal.userData.bounds.min.z*10)/10);
        this._portal.userData.bounds.max = new THREE.Vector3(Math.round(this._portal.userData.bounds.max.x*10)/10, Math.round(this._portal.userData.bounds.max.y*10)/10, Math.round(this._portal.userData.bounds.max.z*10)/10)

        var portalBounds = this._portal.userData.bounds;
        var portalSize = new THREE.Vector3();
        portalBounds.getSize(portalSize);

        if(!hit.object.userData.bounds.containsBox(this._portal.userData.bounds)){

            if(!hit.object.userData.bounds.containsPoint(this._portal.userData.bounds.min)){
                
                var portalMinBounds = this._portal.userData.bounds.min;
                var hitMinBounds = hit.object.userData.bounds.min;
                
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

            // update portal bounds
            this._portal.position.add(this.normal.clone().multiplyScalar(0.01))

            this._portal.userData.bounds = new THREE.Box3().setFromObject(newPortal , true);
            this._portal.userData.bounds.min = new THREE.Vector3(Math.round(this._portal.userData.bounds.min.x*10)/10, Math.round(this._portal.userData.bounds.min.y*10)/10, Math.round(this._portal.userData.bounds.min.z*10)/10);
            this._portal.userData.bounds.max = new THREE.Vector3(Math.round(this._portal.userData.bounds.max.x*10)/10, Math.round(this._portal.userData.bounds.max.y*10)/10, Math.round(this._portal.userData.bounds.max.z*10)/10)
            
        }
    }



    _removePortal(){
        scene.remove(this._portal); // figure out howt to fade out portal
     
    }

    _updatePortal(){
        
        this._updatePortalCamera(); // update position and rotation of the camera based on the relative position of the current camera 
        this._renderPortal(); // render portal scene to the renderTarget
        TWEEN.update();
        this.portalMaterial.uniforms.time.value = scene.userData.globalTime;
 
     }

    _updatePortalCamera(){
        // - calculate camera position
        var portalCamPosFromPortal = this._playerCamera.position.clone().sub(this._portal.position.clone()); // get relative position of player camera to portal 
        var portalCamPos = portalCamPosFromPortal.clone().add(this.secondPortalPos); // add the relative position of camera to the portal position to get position of the portalCamera

        /* Note: The Way the Portal Works /// 
        For the Portal Illusion to work the position and rotation of the second camera relative to its portal needs to be the same as the players camera to the input portal. */

        // update position and rotation
        this.portalCamera.position.copy(portalCamPos);
        this.portalCamera.rotation.copy(this._playerCamera.rotation); // for illusion to work rotation of camera relative to the other portal needs to be the same
        this.portalCamera.setFocalLength(this._playerCamera.getFocalLength ())
        this.portalCamera.updateProjectionMatrix();
    }

    // render the portal to the render Texture
    _renderPortal(){
    
        // render the scene from the portal camera to the render texture
        renderer.setRenderTarget(this.renderTarget); // set the renderTarget of the renderer to the portal render Target
        this._portal.visible = false; // do not render the plane on which the portal will be in the portal scene (avoids recurssion [but can be later implemented])
        renderer.render(scene, this.portalCamera); // render the other room to the render Target
        
        // reset the camera to render from the player camera
        this._portal.visible = true; // set the portal ba
        renderer.setRenderTarget(null); // reset the renderer to render the scene from the main camera
        
        // set the new portal render target to the portal teture
        this.portalMaterial.uniforms.renderTexture.value = this.renderTarget.texture;

    }


    onWindowResize() {
        this.renderTarget.setSize(window.innerWidth,window.innerHeight);
        this.portalCamera.aspect = window.innerWidth / window.innerHeight;
        this.portalCamera.updateProjectionMatrix();
        this._renderPortal();
    }


    linkPortal(secondPortalPos){
        this.secondPortalPos = secondPortalPos;
    }

    _onCollision(){
        // Add teleportation logic here
    }
}