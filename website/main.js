// DEEP DREAM DUNGEON

import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';

import { FBXLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/FBXLoader.js';
import { TWEEN } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/libs/tween.module.min.js';

import {FirstPersonCamera} from "./Scripts/cameraControls/FirstPersonCamera.js"
import {Room} from "./Scripts/portal/Room.js"
import { excludeBones, includeBones } from './Scripts/helperClasses/boneHelpers.js';
import { FaceTrackHelper } from './Scripts/faceTracking/faceTrackHelper.js';

var camera, scene, renderer

var postCamera;
var postRenderTexture;
var postScene;
var postRenderMesh;

export {renderer, scene, actionList};

const clock = new THREE.Clock();
const gestureTimeoutClock = new THREE.Clock();

var themes = [];
var themeIndex = 0;

var handHelper;
var faceHelper;

var portalRoom;
var borderSize = 40;

var themeTrackerCreature;

var uiAnimMixer;
var borderCornerList = [];
var themeLabelVertex, themeLabelFragment, themeLabelMaterial;

var soundPlayer;
var inputTracker;


const preload = async() =>{

    faceHelper = new FaceTrackHelper();
    await faceHelper.initVideo();
    await faceHelper.createFaceLandmarker();

    await fetch("themes/themes.txt").then(res=> res.text()) // TODO: Move to backend'
    .then(text=>{
        themes = text.split(/\r\n|\n/);
    });

    var fLoader2 = await new FBXLoader();
    await fLoader2.load("./Assets/Models/decoration/borderCorner.fbx", (object)=>
            {

                for(var i = 0; i < 4; i++){
                  
                    var corner = new THREE.Object3D().copy(object);
                    corner.scale.set(2,2,2);
                    corner.position.set(
                        (i > 1 ? -1 : 1)*(-window.innerWidth/2+13-borderSize),
                        ((i == 1 || i ==  2)  ? -1 : 1)*(window.innerHeight/2-13+borderSize),-1300
                    );
                    corner.rotateZ(i*Math.PI/2);
                    borderCornerList.push(corner);
                }

                
                borderCornerList.forEach((corner)=>{
                    postScene.add(corner);
                })
            })



    await initSwitchThemeShader();
    await fLoader2.load("./Assets/Models/decoration/meshPlaneMonster2.fbx", (object)=>{
        
        themeTrackerCreature = object; 

        themeTrackerCreature.name = "themeTracker"

        themeTrackerCreature.scale.set(1.5,1.5,1.5)
        themeTrackerCreature.position.set(-250,-200,-1300);
        themeTrackerCreature.rotateY(Math.PI/2)
        themeTrackerCreature.rotateZ(Math.PI/12)

        uiAnimMixer = new THREE.AnimationMixer( themeTrackerCreature );
 
        themeTrackerCreature.userData.IdleAnim = uiAnimMixer.clipAction( themeTrackerCreature.animations[0].clone() );
        themeTrackerCreature.userData.IdleHand = uiAnimMixer.clipAction( themeTrackerCreature.animations[0].clone() );
        themeTrackerCreature.userData.TeleportAnim = uiAnimMixer.clipAction(themeTrackerCreature.animations[2]);
 
        excludeBones(themeTrackerCreature.userData.IdleAnim, ["handLeft"])
        includeBones(themeTrackerCreature.userData.TeleportAnim, ["handLeft"])
        includeBones(themeTrackerCreature.userData.IdleHand, ["handLeft"])

        themeTrackerCreature.userData.TeleportAnim.clampWhenFinished = true;
        themeTrackerCreature.userData.TeleportAnim.loop = THREE.LoopOnce;

        themeTrackerCreature.userData.IdleAnim.play();
        themeTrackerCreature.userData.IdleHand.play();

        postScene.add(themeTrackerCreature);

        if(uiAnimMixer){

            uiAnimMixer.addEventListener("finished",(e)=>{
                
                var tracker = postScene.getObjectByName("themeTracker");
           
                if(e.action._clip.name = "Armature|transition"){
                    tracker.userData.IdleAnim.loop = THREE.LoopRepeat;
                    tracker.userData.IdleHand.reset().play();
                    tracker.userData.TeleportAnim.stop();
        
                }
                
            });
        }

        themeTrackerCreature.getObjectByName("teleportToLocation").material = switchThemeMaterial;
    })
    
    await setup();

}

const setup = async() =>{
    await init();
}

var borderBottom, borderTop, borderLeft, borderRight;
var borderList;

function init() {
    // https://annakap.medium.com/integrating-ml5-js-posenet-model-with-three-js-b19710e2862b

    scene = new THREE.Scene();
    postScene = new THREE.Scene();

    scene.userData.changingScene = false;

    inputTracker = document.getElementById("handInputs");
    
    const container = document.createElement( 'div' );
    document.body.appendChild( container );
    container.id = "container"

    camera = new THREE.PerspectiveCamera( 35, window.innerWidth / window.innerHeight, 0.10, 450 ); // 0.05
 
    postCamera = new THREE.OrthographicCamera( -window.innerWidth/2-borderSize, window.innerWidth/2+borderSize, window.innerHeight/2+borderSize, -window.innerHeight/2-borderSize, 1, 3000 );
    postRenderTexture = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight);

    postRenderMesh = new THREE.Mesh(new THREE.PlaneGeometry(window.innerWidth,window.innerHeight), basicTextureShader(postRenderTexture.texture));
    postRenderMesh.position.set(0,0,-1500)

    postScene.add(postRenderMesh);

    const light = new THREE.AmbientLight(0xffffff,0.5); // soft white light
    postScene.add( light )

    postCamera.lookAt(postRenderMesh.position);

    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
    hemiLight.position.set( 0, 600, 0 );
    scene.add( hemiLight );

    setupLighting();
    //#region  borders
    // add border meshes 

    borderBottom = new THREE.Mesh(new THREE.PlaneGeometry(window.innerWidth+2*borderSize,2.0*borderSize), new THREE.MeshPhongMaterial({transparent: true}));
    borderBottom.position.set(0,-window.innerHeight/2,-1500)

    borderTop = new THREE.Mesh(new THREE.PlaneGeometry(window.innerWidth+2*borderSize,2*borderSize), new THREE.MeshPhongMaterial({transparent: true}));
    borderTop.position.set(0,window.innerHeight/2,-1500)
    borderTop.rotateZ(Math.PI);

    borderLeft = new THREE.Mesh(new THREE.PlaneGeometry(window.innerHeight+2*borderSize,2*borderSize), new THREE.MeshPhongMaterial({transparent: true}));
    borderLeft.position.set(-window.innerWidth/2,0,-1500)
    borderLeft.rotateZ(-Math.PI/2);

    borderRight = new THREE.Mesh(new THREE.PlaneGeometry(window.innerHeight+2*borderSize,2*borderSize), new THREE.MeshPhongMaterial({transparent: true}));
    borderRight.rotateZ(Math.PI/2);
    borderRight.position.set(window.innerWidth/2,0,-1500)

    borderList = [borderBottom, borderTop, borderLeft,borderRight];
    
    postScene.add(...[borderBottom, borderTop, borderLeft,borderRight]);
    //#endregion borders

    var roomBounds = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(400,100,200));

    scene.userData.curRoom = new Room(roomBounds, themes[themeIndex]);
    scene.userData.destinationRoom  = new Room(roomBounds.clone().translate(new THREE.Vector3(200,200,200)), themes[3]);
    
    scene.userData.portalableSurfaces = [];

    scene.userData.curRoom.surfaces.forEach((surface)=>{
        scene.add(surface);
        scene.userData.portalableSurfaces.push(surface);
    })

    scene.userData.destinationRoom.surfaces.forEach((surface)=>{
        scene.add(surface);
        scene.userData.portalableSurfaces.push(surface);
    })

    var canvas = document.createElement('canvas');
    canvas.id = "mainCanvas"

    canvas.onclick = ()=>{
        canvas.requestPointerLock(); // lock pointer to allow to look around
    }

    container.appendChild(canvas);

    // setup renderer

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, canvas: canvas} );
    renderer.setClearColor( 0x000000, 0 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    container.appendChild( renderer.domElement );

    // position player in center 
    camera.position.copy(scene.userData.curRoom._center);

    fpsCamera = new FirstPersonCamera(camera);

    window.addEventListener( 'resize', onWindowResize, false );

    // sound
    soundPlayer = new Tone.Player(`themes/${themes[themeIndex]}/sounds/${themes[themeIndex]}.wav`).toDestination();
    soundPlayer.autostart = true;
    soundPlayer.loop = true;

    createCurThemeTexture();
    initThemelabelShader();
    initBorderShader();

    borderList.forEach((border)=>{
        border.material = borderMaterial;
    })

    // Start the animation Loop
    animate();

}

function setupLighting(){

    const dirLight = new THREE.DirectionalLight( 0xffffff );
    dirLight.position.set( 0, 200, 100 );
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = - 100;
    dirLight.shadow.camera.left = - 120;
    dirLight.shadow.camera.right = 120;
    scene.add( dirLight );

    const dirLight2 = new THREE.DirectionalLight( 0xffffff );
    dirLight2.position.set( 0, 200, 100 );
    dirLight2.castShadow = true;
    dirLight2.shadow.camera.top = 180;
    dirLight2.shadow.camera.bottom = - 100;
    dirLight2.shadow.camera.left = - 120;
    dirLight2.shadow.camera.right = 120;

    postScene.add(dirLight2);

}

// orginal by Stefan Gustavson, Eric Arnebäck, https://github.com/stegu/webgl-noise/blob/master/src/cellular3D.glsl
function worleyNoise(){
    return `
      // Permutation polynomial: (34x^2 + x) mod 289
vec3 permute(vec3 x) {
  return mod((34.0 * x + 1.0) * x, 289.0);
}

vec3 dist(vec3 x, vec3 y, vec3 z,  bool manhattanDistance) {
  return manhattanDistance ?  abs(x) + abs(y) + abs(z) :  (x * x + y * y + z * z);
}

vec2 worley(vec3 P, float jitter, bool manhattanDistance) {
float K = 0.142857142857; // 1/7
float Ko = 0.428571428571; // 1/2-K/2
float  K2 = 0.020408163265306; // 1/(7*7)
float Kz = 0.166666666667; // 1/6
float Kzo = 0.416666666667; // 1/2-1/6*2

	vec3 Pi = mod(floor(P), 289.0);
 	vec3 Pf = fract(P) - 0.5;

	vec3 Pfx = Pf.x + vec3(1.0, 0.0, -1.0);
	vec3 Pfy = Pf.y + vec3(1.0, 0.0, -1.0);
	vec3 Pfz = Pf.z + vec3(1.0, 0.0, -1.0);

	vec3 p = permute(Pi.x + vec3(-1.0, 0.0, 1.0));
	vec3 p1 = permute(p + Pi.y - 1.0);
	vec3 p2 = permute(p + Pi.y);
	vec3 p3 = permute(p + Pi.y + 1.0);

	vec3 p11 = permute(p1 + Pi.z - 1.0);
	vec3 p12 = permute(p1 + Pi.z);
	vec3 p13 = permute(p1 + Pi.z + 1.0);

	vec3 p21 = permute(p2 + Pi.z - 1.0);
	vec3 p22 = permute(p2 + Pi.z);
	vec3 p23 = permute(p2 + Pi.z + 1.0);

	vec3 p31 = permute(p3 + Pi.z - 1.0);
	vec3 p32 = permute(p3 + Pi.z);
	vec3 p33 = permute(p3 + Pi.z + 1.0);

	vec3 ox11 = fract(p11*K) - Ko;
	vec3 oy11 = mod(floor(p11*K), 7.0)*K - Ko;
	vec3 oz11 = floor(p11*K2)*Kz - Kzo; // p11 < 289 guaranteed

	vec3 ox12 = fract(p12*K) - Ko;
	vec3 oy12 = mod(floor(p12*K), 7.0)*K - Ko;
	vec3 oz12 = floor(p12*K2)*Kz - Kzo;

	vec3 ox13 = fract(p13*K) - Ko;
	vec3 oy13 = mod(floor(p13*K), 7.0)*K - Ko;
	vec3 oz13 = floor(p13*K2)*Kz - Kzo;

	vec3 ox21 = fract(p21*K) - Ko;
	vec3 oy21 = mod(floor(p21*K), 7.0)*K - Ko;
	vec3 oz21 = floor(p21*K2)*Kz - Kzo;

	vec3 ox22 = fract(p22*K) - Ko;
	vec3 oy22 = mod(floor(p22*K), 7.0)*K - Ko;
	vec3 oz22 = floor(p22*K2)*Kz - Kzo;

	vec3 ox23 = fract(p23*K) - Ko;
	vec3 oy23 = mod(floor(p23*K), 7.0)*K - Ko;
	vec3 oz23 = floor(p23*K2)*Kz - Kzo;

	vec3 ox31 = fract(p31*K) - Ko;
	vec3 oy31 = mod(floor(p31*K), 7.0)*K - Ko;
	vec3 oz31 = floor(p31*K2)*Kz - Kzo;

	vec3 ox32 = fract(p32*K) - Ko;
	vec3 oy32 = mod(floor(p32*K), 7.0)*K - Ko;
	vec3 oz32 = floor(p32*K2)*Kz - Kzo;

	vec3 ox33 = fract(p33*K) - Ko;
	vec3 oy33 = mod(floor(p33*K), 7.0)*K - Ko;
	vec3 oz33 = floor(p33*K2)*Kz - Kzo;

	vec3 dx11 = Pfx + jitter*ox11;
	vec3 dy11 = Pfy.x + jitter*oy11;
	vec3 dz11 = Pfz.x + jitter*oz11;

	vec3 dx12 = Pfx + jitter*ox12;
	vec3 dy12 = Pfy.x + jitter*oy12;
	vec3 dz12 = Pfz.y + jitter*oz12;

	vec3 dx13 = Pfx + jitter*ox13;
	vec3 dy13 = Pfy.x + jitter*oy13;
	vec3 dz13 = Pfz.z + jitter*oz13;

	vec3 dx21 = Pfx + jitter*ox21;
	vec3 dy21 = Pfy.y + jitter*oy21;
	vec3 dz21 = Pfz.x + jitter*oz21;

	vec3 dx22 = Pfx + jitter*ox22;
	vec3 dy22 = Pfy.y + jitter*oy22;
	vec3 dz22 = Pfz.y + jitter*oz22;

	vec3 dx23 = Pfx + jitter*ox23;
	vec3 dy23 = Pfy.y + jitter*oy23;
	vec3 dz23 = Pfz.z + jitter*oz23;

	vec3 dx31 = Pfx + jitter*ox31;
	vec3 dy31 = Pfy.z + jitter*oy31;
	vec3 dz31 = Pfz.x + jitter*oz31;

	vec3 dx32 = Pfx + jitter*ox32;
	vec3 dy32 = Pfy.z + jitter*oy32;
	vec3 dz32 = Pfz.y + jitter*oz32;

	vec3 dx33 = Pfx + jitter*ox33;
	vec3 dy33 = Pfy.z + jitter*oy33;
	vec3 dz33 = Pfz.z + jitter*oz33;

	vec3 d11 = dist(dx11, dy11, dz11, manhattanDistance);
	vec3 d12 =dist(dx12, dy12, dz12, manhattanDistance);
	vec3 d13 = dist(dx13, dy13, dz13, manhattanDistance);
	vec3 d21 = dist(dx21, dy21, dz21, manhattanDistance);
	vec3 d22 = dist(dx22, dy22, dz22, manhattanDistance);
	vec3 d23 = dist(dx23, dy23, dz23, manhattanDistance);
	vec3 d31 = dist(dx31, dy31, dz31, manhattanDistance);
	vec3 d32 = dist(dx32, dy32, dz32, manhattanDistance);
	vec3 d33 = dist(dx33, dy33, dz33, manhattanDistance);

	vec3 d1a = min(d11, d12);
	d12 = max(d11, d12);
	d11 = min(d1a, d13); // Smallest now not in d12 or d13
	d13 = max(d1a, d13);
	d12 = min(d12, d13); // 2nd smallest now not in d13
	vec3 d2a = min(d21, d22);
	d22 = max(d21, d22);
	d21 = min(d2a, d23); // Smallest now not in d22 or d23
	d23 = max(d2a, d23);
	d22 = min(d22, d23); // 2nd smallest now not in d23
	vec3 d3a = min(d31, d32);
	d32 = max(d31, d32);
	d31 = min(d3a, d33); // Smallest now not in d32 or d33
	d33 = max(d3a, d33);
	d32 = min(d32, d33); // 2nd smallest now not in d33
	vec3 da = min(d11, d21);
	d21 = max(d11, d21);
	d11 = min(da, d31); // Smallest now in d11
	d31 = max(da, d31); // 2nd smallest now not in d31
	d11.xy = (d11.x < d11.y) ? d11.xy : d11.yx;
	d11.xz = (d11.x < d11.z) ? d11.xz : d11.zx; // d11.x now smallest
	d12 = min(d12, d21); // 2nd smallest now not in d21
	d12 = min(d12, d22); // nor in d22
	d12 = min(d12, d31); // nor in d31
	d12 = min(d12, d32); // nor in d32
	d11.yz = min(d11.yz,d12.xy); // nor in d12.yz
	d11.y = min(d11.y,d12.z); // Only two more to go
	d11.y = min(d11.y,d11.z); // Done! (Phew!)
	return sqrt(d11.xy); // F1, F2

}

    `;
}

function initThemelabelShader(){
    themeLabelVertex = `
    varying vec4 vPos;
    varying vec2 vUv;
    uniform float time;
    varying vec3 vnormal;
    uniform float rollTime;

    void main() {
   
        float zPos = vPos.z + 0.4*sin(time*10.0+position.y*3.0)*(uv.x);
        vec3 newPos = vec3(position.xy, (1.0-rollTime)*(1.0-rollTime)*zPos);

        //vec3 newPos = position;

        float t = uv.x;
        float i = 1.0-rollTime;

        //i = 0.0;

        float pi = 355.0/113.0;

        float spiralSize = 0.2; // 0.3 spiral + 0.5 offset also works

        //i = 0.2;

        float zRoll = -spiralSize*(1.0/(t-i+0.5))*(sin(pi*4.0*(t-i)))-4.0*i+1.0;
        float yRoll =-spiralSize*(1.0/(t-i+0.5))*(cos(pi*4.0*(t-i)))+0.3;

        if(t>(i) && i>=0.0){
            newPos = vec3(position.x, zRoll, yRoll);
        }

        vPos = projectionMatrix * modelViewMatrix * vec4( newPos, 1.0 );
        gl_Position = vPos;
        vUv = uv;

        vnormal = normal;

    }
`;

themeLabelFragment = `
    varying vec4 vPos;
    uniform sampler2D themeTexture;
    varying vec2 vUv;
    uniform float time;
    varying vec3 vnormal;
    uniform sampler2D alphaMask;
    uniform vec3 eye;

    uniform float rollTime;


    void main() {
        vec4 finalColor;
        vec4 themeTexture = texture2D(themeTexture,vUv);
        vec4 alphaMask = texture2D(alphaMask,vUv);
        finalColor = vec4(themeTexture.xyz,1.0-rollTime);

        vec4 bgCol = vec4(0.2,0,0,alphaMask.x);
    

        finalColor = mix(finalColor, bgCol, rollTime);

        if(themeTexture.w < 0.2){

            finalColor = bgCol;
        }


        float testTime = (1.0-mod(time/2.0,2.0));
        gl_FragColor = vec4(finalColor.xyz,finalColor.w);
        
      
    }
    `;
    
    var themeAlphaTex = new THREE.TextureLoader().load("./Assets/Models/decoration/bannerAlpha.png");
    themeAlphaTex.minFilter = THREE.NearestFilter;
    themeAlphaTex.magFilter = THREE.NearestFilter

    themeLabelMaterial = new THREE.ShaderMaterial( {


        uniforms: {
            themeTexture: {value: curThemeTexture},
            alphaMask: {value: themeAlphaTex},
            time: {value: 0},
            rollTime: {value: 0}
        },
    
        // Declare Vertex and Fragment Shader
        vertexShader: themeLabelVertex,
        fragmentShader: themeLabelFragment,

        side: THREE.DoubleSide,

        
        uniformsNeedUpdate: true,  
        transparent: true
    
    } );

}

var borderVertex, borderFragment, borderMaterial;
function initBorderShader(){
    borderVertex = `
    varying vec4 vPos;
    varying vec2 vUv;
    uniform float time;
    varying vec3 vnormal;
    uniform float rollTime;

    void main() {
   
    
        vPos = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        gl_Position = vPos;
        vUv = uv;

        vnormal = normal;

    }
`;

    borderFragment = worleyNoise()+`
    varying vec4 vPos;
    varying vec2 vUv;
    uniform float time;

    void main() {
        
        gl_FragColor = vec4((vUv.y/2.0+0.2)*worley(20.0*vec3(vPos.xy,time/100.0),0.01, false).y,0,0.0,1);
        
    }
    `;
    
    borderMaterial = new THREE.ShaderMaterial( {

        uniforms: {
            time: {value: 0},
        },
    
        // Declare Vertex and Fragment Shader
        vertexShader: borderVertex,
        fragmentShader: borderFragment,

        uniformsNeedUpdate: true,  
    
    } );

}

var switchThemeMaterial;
function initSwitchThemeShader(){
    var switchThemeVertex  = `
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
    var switchThemeFragment = `
        varying vec4 vPos;
        varying vec4 testPos;
        uniform sampler2D curTheme;
        uniform sampler2D eyeTex;
        uniform float switchTime;
        uniform float time;

        varying vec2 vUv;

    
        void main() {
            
            vec4 curThemeCol= texture2D(curTheme,vUv);

            mat2 eyeRotation = mat2(
                cos(time), sin(time),
                -sin(time), cos(time)
            );

            vec4 eyeCol = texture2D(eyeTex, (vUv-vec2(0.5,0.5))*eyeRotation+vec2(0.5,0.5));

            gl_FragColor = curThemeCol;
  
            vec2 center1 = vec2(0.5,0.5)+vec2(0,0.5*(1.0-switchTime));
            vec2 center2 = vec2(0.5,0.5)-vec2(0,0.5*(1.0-switchTime));

            if(distance(center1,vUv) < 0.5 && distance(center2,vUv) < 0.5){
                 gl_FragColor = eyeCol;
            }

        }
        `;

    switchThemeMaterial = new THREE.ShaderMaterial( {

        uniforms: {
            curTheme: {value: new THREE.TextureLoader().load( `./themes/${themes[0]}/textures/icon.png`)},
            eyeTex: {value: new THREE.TextureLoader().load( `Assets/Images/eye.png`)},    
            switchTime: {value: 0},
            time: {value: 0}
        },
    
        // Declare Vertex and Fragment Shader
        vertexShader: switchThemeVertex,
        fragmentShader: switchThemeFragment,
        
        uniformsNeedUpdate: true  
    
    } );
}

var curThemeCanvas, curThemeTexture

function createCurThemeTexture(){
      
      //#region destination text canvas
      curThemeCanvas = document.createElement("canvas")
      curThemeCanvas.id = "canvasDestination"
      const context = curThemeCanvas.getContext("2d")
      
      curThemeCanvas.width = 1000;
      curThemeCanvas.height = 100;
  
      context.font = "70px Comic Sans MS";

      curThemeTexture = new THREE.CanvasTexture(curThemeCanvas);

      updateCurThemeTexture();
}

document.addEventListener("teleport",(e)=>{
    soundPlayer.load(`themes/${scene.userData.curRoom._curTheme}/sounds/${scene.userData.curRoom._curTheme}.wav`);
    var tracker = postScene.getObjectByName("themeTracker");
    tracker.userData.IdleHand.fadeOut(0.5);
    tracker.userData.TeleportAnim.fadeIn(0.5).reset().play(); // FIX ME : JUMPING ON TELEPORT BUG ON THE UI

    if(postScene.getObjectByName("themeTracker")){
        var tracker = postScene.getObjectByName("themeTracker");

        new TWEEN.Tween(themeLabelMaterial.uniforms.rollTime).to({value:1},1000).easing(TWEEN.Easing.Sinusoidal.InOut).start().onComplete(()=>{
            updateCurThemeTexture();
            themeLabelMaterial.uniforms.themeTexture.value.needsUpdate = true;
            new TWEEN.Tween(themeLabelMaterial.uniforms.rollTime).to({value:0},1000).easing(TWEEN.Easing.Sinusoidal.InOut).start()

        })

        new TWEEN.Tween(switchThemeMaterial.uniforms.switchTime).to({value:1},1000).easing(TWEEN.Easing.Sinusoidal.InOut).start().onComplete(()=>{
            switchThemeMaterial.uniforms.curTheme.value = new THREE.TextureLoader().load( `./themes/${scene.userData.curRoom._curTheme}/textures/icon.png`); 
            new TWEEN.Tween(switchThemeMaterial.uniforms.switchTime).to({value:0},1000).easing(TWEEN.Easing.Sinusoidal.InOut).start()
            // on complete themeSwithcMaterial
        })

    }
 

   
});

function updateCurThemeTexture(){

    var curThemeText = scene.userData.curRoom._curTheme;    

    var ctx = curThemeCanvas.getContext("2d");
    ctx.clearRect(0,0,curThemeCanvas.width,curThemeCanvas.height);
    ctx.font = "40px Comic Sans MS";
    ctx.lineWidth = 2; 
    var textWidth = ctx.measureText(curThemeText).width;

    // scale text if its too long
    if(textWidth > curThemeCanvas.width){

        ctx.font = `${ (curThemeCanvas.width / textWidth)* 70}px Comic Sans MS`;
        ctx.lineWidth = (curThemeCanvas.width / textWidth)*3; 
        textWidth = ctx.measureText(curThemeText).width;

    } 

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black'
   
    ctx.fillText(curThemeText, (curThemeCanvas.width/2) - (textWidth/2), (curThemeCanvas.height/2)+25);
    //ctx.strokeText(curThemeText, (curThemeCanvas.width/2) - (textWidth/2), (curThemeCanvas.height/2)+25);

    if(postScene.getObjectByName("themeTracker")){
        var tracker = postScene.getObjectByName("themeTracker");
        if(tracker.getObjectByName("themePlane").material != themeLabelMaterial){
            tracker.getObjectByName("themePlane").material = themeLabelMaterial;
            themeLabelMaterial.uniforms.themeTexture.value = curThemeTexture;
            themeLabelMaterial.uniforms.themeTexture.value.needsUpdate = true
        }
    }
}

var fpsCamera;


var teleportToIndex;

function actionsToText(listOfActions){
    
    teleportToIndex = 0;

    listOfActions.forEach((action)=>{
        teleportToIndex += faceToBinary[action]; 
    });



}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setPixelRatio(window.devicePixelRatio)

    postRenderTexture.setSize(window.innerWidth,window.innerHeight);

    camera.updateProjectionMatrix();

    postRenderMesh.geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);


    borderBottom.geometry = new THREE.PlaneGeometry(window.innerWidth+2*borderSize,2.0*borderSize);
    borderBottom.position.set(0,-window.innerHeight/2,-1500);
    
    borderTop.geometry = new THREE.PlaneGeometry(window.innerWidth+2*borderSize,2.0*borderSize)
    borderTop.position.set(0,window.innerHeight/2,-1500)
    
    borderLeft.geometry = new THREE.PlaneGeometry(window.innerHeight+2*borderSize,2*borderSize)
    borderLeft.position.set(-window.innerWidth/2,0,-1500)
    
    borderRight.geometry = new THREE.PlaneGeometry(window.innerHeight+2*borderSize,2*borderSize)
    borderRight.position.set(window.innerWidth/2,0,-1500)

    postCamera.left = -window.innerWidth/2-borderSize;
    postCamera.right = window.innerWidth/2+borderSize;
    postCamera.top = window.innerHeight/2+borderSize;
    postCamera.bottom = -window.innerHeight/2-borderSize;

    postCamera.updateProjectionMatrix()

    // update corner positions
    for(var i = 0; i < 4; i++){
        var corner = borderCornerList[i];
        corner.scale.set(2,2,2);
        corner.position.set(
            (i > 1 ? -1 : 1)*(-window.innerWidth/2+13-borderSize),
            ((i == 1 || i ==  2)  ? -1 : 1)*(window.innerHeight/2-13+borderSize),-1300
        );
    }

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function basicTextureShader(texture) {

    // code from https://stackoverflow.com/questions/71584030/rendertarget-as-new-texture-returns-only-a-black-and-white-texture
    // create basic shader material as 

    const Vertex = `
      varying vec2 vUv;
      void main() {
          vUv = uv;
          vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * modelViewPosition;
      }`;
  
    const Fragment = `
  
      uniform sampler2D tex;
      varying vec2 vUv;
      void main() {
          vec4 color = texture2D(tex, vUv);
          gl_FragColor = color;
      }`;
  
    const uniforms = {
      tex: {
        value: texture
      }
    };
  
    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: Vertex,
      fragmentShader: Fragment,
    });
  
  }

var actionList = [];
var isGestureTimeOut = false;
var gestureTimeOut = 1;

// var unMappedActionsList = ["None", "Open_Palm", "Closed_Fist", "Pointing_Up", "Pointing_Down"]

var unMappedActionsList = ["Open", "None"]
var addedMeshToScene = false;

function animate() {

    requestAnimationFrame( animate );

    if(faceHelper.mesh && !addedMeshToScene){
        scene.userData.faceMesh = faceHelper.mesh
        addedMeshToScene = true;
    }

    const delta = clock.getDelta();

    scene.userData.globalDelta = delta;
    scene.userData.globalTime = clock.getElapsedTime();

    if(uiAnimMixer){
        uiAnimMixer.update(scene.userData.globalDelta);
        themeLabelMaterial.uniforms.time.value = clock.getElapsedTime(); // FIX ME MOVE SOMEWHERE ELSE
    }

    if(borderMaterial){
        borderMaterial.uniforms.time.value = scene.userData.globalTime;
        borderMaterial.uniforms.time.needsUpdate = true;
    }
    
    TWEEN.update();
    themeLabelMaterial.uniforms.rollTime.needsUpdate = true;

    switchThemeMaterial.uniforms.time.value = scene.userData.globalTime;
    switchThemeMaterial.uniforms.time.needsUpdate = true;

    faceHelper.getFaceLandmarks().then(() => {

        if(gestureTimeoutClock.getElapsedTime() > gestureTimeOut){
        
            gestureTimeoutClock.stop();
            isGestureTimeOut = false;
        }

        if (scene.userData.changingScene && !isGestureTimeOut){

            faceHelper.getFaceLandmarks().then((action)=>{
            
            // No_Hands
            if(action != "No_Face"){

                if (!actionList.includes(action) && !unMappedActionsList.includes(action)){
                    actionList.push(action);
                    isGestureTimeOut = true;
                    gestureTimeoutClock.start();

                    document.dispatchEvent(new CustomEvent("actionAdded", {detail: action}));

                    actionsToText(actionList);
                } 

            }

            // FIX ME: MOVE THIS TO SEPARATE FUNCTION

            var totalIndex = 0;
            if (actionList.length > 0){
            actionList.forEach((action)=>{
                totalIndex += faceToBinary[action] //gestureToBinary[action];
            })
            }   
                scene.userData.destinationTheme = themes[totalIndex];
            })
        }
    })

    fpsCamera.update(delta);


     // render the scene from the portal camera to the render texture
    renderer.setRenderTarget(postRenderTexture); // set the renderTarget of the renderer to the portal render Target
    renderer.render( scene, camera );

    renderer.setRenderTarget(null); 

    // do post processing pass
    postRenderMesh.material.uniforms.tex.value = postRenderTexture.texture;
    postRenderMesh.material.uniforms.tex.needsUpdate = true;

    renderer.render(postScene, postCamera);

    updateCurThemeTexture(); // move this FIX ME
}

document.addEventListener("fire",()=>{processIndex(actionList);});

var gestureToBinary = {
    "Thumb_Up": 1,
    "Thumb_Down": 2,
    "Victory": 4,
    "ILoveYou": 8,
}

var faceToBinary = {
    "Kiss": 1,
    "Smile": 2,
    "Frown": 4,
    "Pressed": 8,
}

async function processIndex(actionList){

    var totalIndex = 0;

    actionList.forEach((action)=>{
        totalIndex += faceToBinary[action] //gestureToBinary[action];
    })

    if(totalIndex > themes.length){
        totalIndex = themes.length-1;
    } 

    themeIndex = totalIndex;

    scene.userData.destinationRoom.updateTheme(themes[themeIndex])

    // add listner to update
  

    actionList.length = 0;

    scene.userData.changingScene = false;
    teleportToIndex=0;
}

// begin script execution
preload();