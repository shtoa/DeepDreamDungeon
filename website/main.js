// DEEP DREAM DUNGEON

import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';
//import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.170.0/three.module.js';

import {HandTrackHelper} from "./handTrackHelper.js" 
import {FirstPersonCamera} from "./FirstPersonCamera.js"
import {Room} from "./Room.js"

import { FBXLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/FBXLoader.js';

import { excludeBones, includeBones } from './boneHelpers.js';

import { TWEEN } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/libs/tween.module.min.js';
import { FaceTrackHelper } from './faceTrackHelper.js';

import { Joystick } from './joystick.js';

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
    await fLoader2.load("borderCorner.fbx", (object)=>
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




    await fLoader2.load("meshPlaneMonster2.fbx", (object)=>{
        
        themeTrackerCreature = object; 

        themeTrackerCreature.name = "themeTracker"

        themeTrackerCreature.scale.set(1.2,1.2,1.2)
        themeTrackerCreature.position.set(-250,-150,-1300);
        themeTrackerCreature.rotateY(Math.PI/2)
        themeTrackerCreature.rotateZ(Math.PI/12)

        uiAnimMixer = new THREE.AnimationMixer( themeTrackerCreature );
 
        themeTrackerCreature.userData.IdleAnim = uiAnimMixer.clipAction( themeTrackerCreature.animations[0].clone() );
        themeTrackerCreature.userData.IdleHand = uiAnimMixer.clipAction( themeTrackerCreature.animations[0].clone() );
        themeTrackerCreature.userData.TeleportAnim = uiAnimMixer.clipAction(themeTrackerCreature.animations[2]);
 
        excludeBones(themeTrackerCreature.userData.IdleAnim, ["handLeft"])
        includeBones(themeTrackerCreature.userData.TeleportAnim, ["handLeft"])
        includeBones(themeTrackerCreature.userData.IdleHand, ["handLeft"])

        console.log(themeTrackerCreature.userData.IdleAnim)

        themeTrackerCreature.userData.TeleportAnim.clampWhenFinished = true;
        themeTrackerCreature.userData.TeleportAnim.loop = THREE.LoopOnce;

        themeTrackerCreature.userData.IdleAnim.play();
        themeTrackerCreature.userData.IdleHand.play();

        postScene.add(themeTrackerCreature);

        console.log(themeTrackerCreature);

        if(uiAnimMixer){
            console.log("LOADED MIXER")
            uiAnimMixer.addEventListener("finished",(e)=>{
                
                var tracker = postScene.getObjectByName("themeTracker");
           
                if(e.action._clip.name = "Armature|transition"){
                    tracker.userData.IdleAnim.loop = THREE.LoopRepeat;
                    tracker.userData.IdleHand.reset().play();
                    tracker.userData.TeleportAnim.stop();
        
                }
                
            });
        }
    })
    
    await setup();

}

const setup = async() =>{
    await init();
}

function init() {
    // https://annakap.medium.com/integrating-ml5-js-posenet-model-with-three-js-b19710e2862b

    scene = new THREE.Scene();
    postScene = new THREE.Scene();

    scene.userData.changingScene = false;

    inputTracker = document.getElementById("handInputs");
    
    const container = document.createElement( 'div' );
    document.body.appendChild( container );
    container.id = "container"

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.05, 500 );
 
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

    var borderBottom = new THREE.Mesh(new THREE.PlaneGeometry(window.innerWidth+2*borderSize,4*borderSize), new THREE.MeshPhongMaterial({transparent: true}));
    borderBottom.position.set(0,-window.innerHeight/2+borderSize/2,-1500)

    var teethTexture = new THREE.TextureLoader().load("teeth.png");
    teethTexture.wrapS = THREE.RepeatWrapping;
    teethTexture.wrapT = THREE.ClampToEdgeWrapping;

    teethTexture.repeat.set(1,1);

    // borderBottom.material.map = teethTexture

    var borderTop = new THREE.Mesh(new THREE.PlaneGeometry(window.innerWidth+2*borderSize,3*borderSize), new THREE.MeshPhongMaterial({transparent: true}));
    borderTop.position.set(0,window.innerHeight/2-borderSize/2,-1500)
    borderTop.rotateZ(Math.PI);
    // borderTop.material.map = teethTexture;

    // postScene.add(borderBottom);
    // postScene.add(borderTop);
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

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, canvas: canvas } );
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
    soundPlayer = new Tone.Player(`themes/${themes[themeIndex]}/sounds/${themes[themeIndex]}.wav`) //.toDestination();
    soundPlayer.autostart = true;
    soundPlayer.loop = true;

    // text labels
    updateGestureText("Gesture List: \n")

    createCurThemeTexture();
    initThemelabelShader();

    // if( ('ontouchstart' in window)){
    //     scene.userData.joyStickDelta = new THREE.Vector2(0,0);
    //     initializeJoystick();
    // }

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

function glslNoise(){
    return `
        //	Simplex 4D Noise 
//	by Ian McEwan, Stefan Gustavson (https://github.com/stegu/webgl-noise)
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
float permute(float x){return floor(mod(((x*34.0)+1.0)*x, 289.0));}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float taylorInvSqrt(float r){return 1.79284291400159 - 0.85373472095314 * r;}

vec4 grad4(float j, vec4 ip){
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
  vec4 p,s;

  p.xyz = floor( fract (vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
  p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0)));
  p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www; 

  return p;
}

float snoise(vec4 v){
  const vec2  C = vec2( 0.138196601125010504,  // (5 - sqrt(5))/20  G4
                        0.309016994374947451); // (sqrt(5) - 1)/4   F4
// First corner
  vec4 i  = floor(v + dot(v, C.yyyy) );
  vec4 x0 = v -   i + dot(i, C.xxxx);

// Other corners

// Rank sorting originally contributed by Bill Licea-Kane, AMD (formerly ATI)
  vec4 i0;

  vec3 isX = step( x0.yzw, x0.xxx );
  vec3 isYZ = step( x0.zww, x0.yyz );
//  i0.x = dot( isX, vec3( 1.0 ) );
  i0.x = isX.x + isX.y + isX.z;
  i0.yzw = 1.0 - isX;

//  i0.y += dot( isYZ.xy, vec2( 1.0 ) );
  i0.y += isYZ.x + isYZ.y;
  i0.zw += 1.0 - isYZ.xy;

  i0.z += isYZ.z;
  i0.w += 1.0 - isYZ.z;

  // i0 now contains the unique values 0,1,2,3 in each channel
  vec4 i3 = clamp( i0, 0.0, 1.0 );
  vec4 i2 = clamp( i0-1.0, 0.0, 1.0 );
  vec4 i1 = clamp( i0-2.0, 0.0, 1.0 );

  //  x0 = x0 - 0.0 + 0.0 * C 
  vec4 x1 = x0 - i1 + 1.0 * C.xxxx;
  vec4 x2 = x0 - i2 + 2.0 * C.xxxx;
  vec4 x3 = x0 - i3 + 3.0 * C.xxxx;
  vec4 x4 = x0 - 1.0 + 4.0 * C.xxxx;

// Permutations
  i = mod(i, 289.0); 
  float j0 = permute( permute( permute( permute(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = permute( permute( permute( permute (
             i.w + vec4(i1.w, i2.w, i3.w, 1.0 ))
           + i.z + vec4(i1.z, i2.z, i3.z, 1.0 ))
           + i.y + vec4(i1.y, i2.y, i3.y, 1.0 ))
           + i.x + vec4(i1.x, i2.x, i3.x, 1.0 ));
// Gradients
// ( 7*7*6 points uniformly over a cube, mapped onto a 4-octahedron.)
// 7*7*6 = 294, which is close to the ring size 17*17 = 289.

  vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0) ;

  vec4 p0 = grad4(j0,   ip);
  vec4 p1 = grad4(j1.x, ip);
  vec4 p2 = grad4(j1.y, ip);
  vec4 p3 = grad4(j1.z, ip);
  vec4 p4 = grad4(j1.w, ip);

// Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  p4 *= taylorInvSqrt(dot(p4,p4));

// Mix contributions from the five corners
  vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
  vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)            ), 0.0);
  m0 = m0 * m0;
  m1 = m1 * m1;
  return 49.0 * ( dot(m0*m0, vec3( dot( p0, x0 ), dot( p1, x1 ), dot( p2, x2 )))
               + dot(m1*m1, vec2( dot( p3, x3 ), dot( p4, x4 ) ) ) ) ;

}

    `;
}

function initThemelabelShader(){
    themeLabelVertex = glslNoise()+`
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
    
    var themeAlphaTex = new THREE.TextureLoader().load("alphaTestBanner.png");
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

function updateGestureText(text){

    // inputTracker.innerHTML = text;

}

var teleportToIndex;

function actionsToText(listOfActions){
    
    updateGestureText("");
    var text = "Gesture List: <br><ul>";
    teleportToIndex = 0;

    listOfActions.forEach((action)=>{
        text += `<li> ${action} </li>`
        teleportToIndex += faceToBinary[action]; // gestureToBinary
    });

    updateGestureText(text);

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setPixelRatio(window.devicePixelRatio)

    postRenderTexture.setSize(window.innerWidth,window.innerHeight);

    camera.updateProjectionMatrix();

    postRenderMesh.geometry = new THREE.PlaneGeometry(window.innerWidth, window.innerHeight);

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
    
    TWEEN.update();
    themeLabelMaterial.uniforms.rollTime.needsUpdate = true;

    faceHelper.getFaceLandmarks().then(() => {

        if(gestureTimeoutClock.getElapsedTime() > gestureTimeOut){
        
            gestureTimeoutClock.stop();
            isGestureTimeOut = false;
        }

        if (scene.userData.changingScene && !isGestureTimeOut){

            faceHelper.getFaceLandmarks().then((action)=>{
            
            // No_Hands
            if(action != "No_Face"){

                if(actionList.length == 0 && !unMappedActionsList.includes(action)){
                    actionList.push(action);
                    isGestureTimeOut = true;
                    gestureTimeoutClock.start();
                    actionsToText(actionList);
                } 
                
                if (!actionList.includes(action) && !unMappedActionsList.includes(action)){
                    actionList.push(action);
                    isGestureTimeOut = true;
                    gestureTimeoutClock.start();
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
    console.log(totalIndex);

    themeIndex = totalIndex;

    scene.userData.destinationRoom.updateTheme(themes[themeIndex])

    // add listner to update
    // soundPlayer.load(`themes/${themes[themeIndex]}/sounds/${themes[themeIndex]}.wav`);

    actionList.length = 0;

    scene.userData.changingScene = false;
    teleportToIndex=0;
}

// begin script execution
preload();