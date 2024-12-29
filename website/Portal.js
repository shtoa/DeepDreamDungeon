// class for oneway Portal

export class Portal{

    constructor(scene, renderer){

        this._scene = scene;
        this._renderer = renderer;

        // intialize renderTarget for the portal
        this.renderTarget = new THREE.WebGLRenderTarget( 1024, 1024);
        this.portalCamera = new THREE.PerspectiveCamera( 45, this._camera.aspect, 1, 2000 ); // make sure to scale when resizing 
        
        this.portalGeom = new THREE.PlaneGeometry(40,40);

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

            varying vec2 vUv;

        
            void main() {
                vec2 vCoords = vPos.xy;
                vCoords /= vPos.w;
                vCoords = vCoords * 0.5 + 0.5;
                vec2 suv = vCoords;
                
                vec4 pMask = texture2D(portalMask,vUv);
                vec4 portal = texture2D(renderTexture, suv);

                vec4 maskedPortal = vec4(portal.x,portal.y,portal.z,portal.w);
                
                if(pMask.x == 1.0){
                    discard;
                }

                gl_FragColor = maskedPortal;
            }
            `;
        this.portalMaterial = new THREE.ShaderMaterial( {

                // Set Render Texturew to Texture of Portla
                // Add a mask to give portal and elliptical shape
                uniforms: {
                    portalMask: {value: new THREE.TextureLoader().load("./portalMask.png")},
                    renderTexture: {value: this.renderTarget.texture},
                },
            
                // Declare Vertex and Fragment Shader
                vertexShader: this.vertexShader,
                fragmentShader: this.fragmentShader,
                
                // Pervent Z fighting
                polygonOffset: true,
                polygonOffsetFactor: -20,

                uniformsNeedUpdate: true  
            
            } );

        //#endregion

        document.addEventListener("resize", this.onWindowResize.bind(this));

        this.portalMesh = new THREE.Mesh(this.portalGeom, this.portalMaterial);

    }

    _updatePortal(){
        
        this._updatePortalCamera(); // update position and rotation of the camera based on the relative position of the current camera 
        this._renderPortal(); // render portal scene to the renderTarget
 
     }

    _updatePortalCamera(){
        // - calculate camera position
        var portalCamPosFromPortal = this._playerCamera.position.clone().sub(this.position.clone()); // get relative position of player camera to portal 
        var portalCamPos = portalCamPosFromPortal.clone().add(this.secondPortalPos); // add the relative position of camera to the portal position to get position of the portalCamera

        /* Note: The Way the Portal Works /// 
        For the Portal Illusion to work the position and rotation of the second camera relative to its portal needs to be the same as the players camera to the input portal. */

        // update position and rotation
        this.portalCamera.position.copy(portalCamPos);
        this.portalCamera.rotation.copy(this._playerCamera.rotation); // for illusion to work rotation of camera relative to the other portal needs to be the same
        this.portalCamera.updateProjectionMatrix();
    }

        // render the portal to the render Texture
        _renderPortal(){
        
            // render the scene from the portal camera to the render texture
            this._renderer.setRenderTarget(this.renderTarget); // set the renderTarget of the renderer to the portal render Target
            this._portal.visible = false; // do not render the plane on which the portal will be in the portal scene (avoids recurssion [but can be later implemented])
            this._renderer.render(this._scene, this.portalCamera); // render the other room to the render Target
            
            // reset the camera to render from the player camera
            this._portal.visible = true; // set the portal ba
            this._renderer.setRenderTarget(null); // reset the renderer to render the scene from the main camera
            
            // set the new portal render target to the portal teture
            this.portalMaterial.uniforms.renderTexture.value = this.renderTarget.texture;
    
        }


    onWindowResize() {

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}