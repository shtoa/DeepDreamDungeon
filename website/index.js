// DEEP DREAM DUNGEON


import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';

// https://codepen.io/mediapipe-preview/pen/zYamdVd?editors=1010
import * as HandHelper from "./handTrackHelper.js" 
import * as FirstPersonCamera from "./FirstPersonCamera.js"
import * as Room from "./Room.js"

  
import * as OrbitControls from "https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/OrbitControls.js"
import { FBXLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/FBXLoader.js';
import {Text} from 'https://cdn.jsdelivr.net/npm/troika-three-text@0.52.0/+esm';
import { TWEEN } from 'https://unpkg.com/three@0.139.0/examples/jsm/libs/tween.module.min.js';

import { PointerLockControls } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/PointerLockControls.js';

var camera, scene, renderer



const clock = new THREE.Clock();
const gestureTimeoutClock = new THREE.Clock();

let mixer;

// https://github.com/devinekask/creative-code-3-f24/blob/main/ml5/demos/03-handpose-vanilla-js.html

var themes = [];
var themeIndex = 0;

var handHelper;

const preload = async() =>{
    //handpose = ml5.handPose(); //video, options;
    // await handpose.ready;
    handHelper = await new HandHelper.HandTrackHelper();
     


    await fetch("/themes/themes.txt").then(res=> res.text())
    .then(text=>{
        themes = text.split(/\r\n|\n/);
    });

    await setup();
   
}

const setup = async() =>{
    
    await handHelper.initVideo();
    await handHelper.getPose(); // test to prevent stuttering when shooting
    init();

}


var categories = [
    "None",
    "Closed_Fist",
    "Open_Palm",
    "Thumb_Up",
    "Thumb_Down",
]
var categoriesMap = new Map();
var rect;
var controls;
var floorMesh;
var wallMesh;
var ceilingMesh;
var themeLabel = new Text();
var gestureLabel = new Text();
var gunModel;
var room;
var room2;

var soundPlayer;

var themeTracker;
var inputTracker;


var firingEvent;
var renderTarget;

function init() {
    // https://annakap.medium.com/integrating-ml5-js-posenet-model-with-three-js-b19710e2862b
    

    scene = new THREE.Scene();

    themeTracker = document.getElementById("currentTheme");
    inputTracker = document.getElementById("handInputs");
    

    const container = document.createElement( 'div' );
    document.body.appendChild( container );
    container.id = "snuggle"

    //container.requestPointerLock();

    rect = document.getElementById("snuggle").getBoundingClientRect()

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
   // camera.position.set( 0, 10, 0 );

    const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444 );
    hemiLight.position.set( 0, 600, 0 );
    scene.add( hemiLight );

    const dirLight = new THREE.DirectionalLight( 0xffffff );
    dirLight.position.set( 0, 200, 100 );
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = - 100;
    dirLight.shadow.camera.left = - 120;
    dirLight.shadow.camera.right = 120;
    scene.add( dirLight );

    // scene.add( new THREE.CameraHelper( dirLight.shadow.camera ) );

    var roomBounds = new THREE.Box3(new THREE.Vector3(0,0,0), new THREE.Vector3(400,100,200));

    const helper = new THREE.Box3Helper( roomBounds, 0xffff00 );
    scene.add( helper );

    room = new Room.Room(roomBounds, themes[themeIndex]);


    // 400,110,0
    room2 = new Room.Room(roomBounds.clone().translate(new THREE.Vector3(0,110,0)), themes[3]);
    
    room.surfaces.forEach((surface)=>{
        scene.add(surface);
    })

    room2.surfaces.forEach((surface)=>{
        scene.add(surface);
    })


    const grid = new THREE.GridHelper( 2000, 20, 0x000000, 0x000000 );
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add( grid );

    // model
    const loader = new FBXLoader();

    var canvas = document.createElement('canvas');
    canvas.id = "mainCanvas"

    canvas.onclick = ()=>{
        canvas.requestPointerLock();
    }




    container.appendChild(canvas);

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, canvas: canvas } );
    renderer.setClearColor( 0x000000, 0 );
    renderer.setPixelRatio( window.devicePixelRatio );
    //renderer.setSize( 500, 500 );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild( renderer.domElement );

    // position player in center 
    camera.position.set(room._center.x, room._center.y, room._center.z);


    fpsCamera = new FirstPersonCamera.FirstPersonCamera(camera, roomBounds, room, scene, renderer, room2.bounds);
    //
    var fLoader = new FBXLoader();
    
    fLoader.load("gun.fbx", (object)=>
    {

        object.position.set(0.6,-0.3,-1.2)

        var scale = 0.005;
        object.scale.set(scale,scale,scale);
  
        scene.add(object)
       
        gunModel = object;

        const video = document.getElementById( 'video' );
        const texture = new THREE.VideoTexture( video )
        
  

        console.log(gunModel.children);
        gunModel.children[1].material.map = texture;

        gunModel.children.forEach(child => {
                child.renderOrder = -1
         
            
            }
        )

        object.parent = fpsCamera._camera;

    });




    // camera controlls

    //controls = new FirstPersonControls( camera, renderer.domElement);
	//controls.target.set( 0, 50, 0 );
    //controls.enablePan = false;

    window.addEventListener( 'resize', onWindowResize, false );


    // sound

    soundPlayer = new Tone.Player(`themes/${themes[themeIndex]}/sounds/${themes[themeIndex]}.wav`) //.toDestination();
    soundPlayer.autostart = true;
    soundPlayer.loop = true;


    // text labels

            
    themeTracker.innerHTML = `Current Theme: ${themes[themeIndex]}!`;


    scene.add(themeLabel);

    updateGestureText("Gesture List: \n")


    var testMesh = new THREE.Mesh( new THREE.BoxBufferGeometry( 30, 30, 30 ), new THREE.MeshPhongMaterial( ) );
    testMesh.position.set(room._center.x, room._center.y, room._center.z);
    testMesh.geometry.rotateX(Math.PI/4);
    scene.add(testMesh);
   

    testMesh.geometry.computeFaceNormals();
    
    room.surfaces.push(testMesh);

    renderTarget = new THREE.WebGLRenderTarget( 512, 512, { format: THREE.RGBFormat } );

    animate();

}

var fpsCamera;

function updateGestureText(text){
    gestureLabel.dispose();
    scene.remove(gestureLabel);
    gestureLabel = new Text();
    
    gestureLabel.text = text;
    gestureLabel.fontSize = 8;
    gestureLabel.outlineWidth = "10%";
    gestureLabel.position.set(-100,100,0);
    gestureLabel.textAlign = "left";
    gestureLabel.anchorX = "left";
    gestureLabel.sync();

    inputTracker.innerHTML = text;

    scene.add(gestureLabel);
}

function actionsToText(listOfActions){
    updateGestureText("")
    var text = "Gesture List: <br><ul>";
    var teleportToIndex = 0;

    listOfActions.forEach((action)=>{
        text += `<li> ${action} </li>`
        teleportToIndex += gestureToBinary[action];
    });

    text =`</ul> will teleport to: <br> <span style="color:red"> ${themes[teleportToIndex]} </span> <br>
    ` + text;



    updateGestureText(text);

}



function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    renderer.setPixelRatio(window.devicePixelRatio)
    camera.updateProjectionMatrix();


    //renderer.setSize(camera.aspect*500, 500);

    renderer.setSize(window.innerWidth, window.innerHeight);
}

//
preload();

var avgPos;

var curAnim = {
    name: "None",
    action: categoriesMap["None"]
}

var prevAnim = {
    
    name: "None",
    action: categoriesMap["None"]
    
}

let mousePos = {
    x:0,
    y:0,
    z:0
}

const raycaster = new THREE.Raycaster();


var plane;



window.addEventListener("pointerdown",(e)=>{
    // if(camera != null){
    //     plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(), 
    //         new THREE.Vector3(0,0,0)
    //     )
   

    // //console.log(window)
    // mousePos.x = (-1 + 2 * (e.clientX) / (window.innerWidth));
    // mousePos.y = (1 + 2 * (-e.clientY) / (window.innerHeight));

    // raycaster.setFromCamera( mousePos, camera );
    
    // var intersectPos = new THREE.Vector3();
    // raycaster.ray.intersectPlane(plane,intersectPos);

    // //console.log(intersectPos);
    // }
})


var actionList = [];
var changingScene = false;
var isGestureTimeOut = false;
var gestureTimeOut = 1;

function animate() {

    requestAnimationFrame( animate );

   
 

    const delta = clock.getDelta();
    if ( mixer ) {
        mixer.update( delta )
    };


    
    //controls.update()
    TWEEN.update();
   
    
    const nowInMs = Date.now();



    if(gestureTimeoutClock.getElapsedTime() > gestureTimeOut){
      
        gestureTimeoutClock.stop();
        isGestureTimeOut = false;
    }

    if (changingScene && !isGestureTimeOut){
    
  
        var action = handHelper.getPose();
        
        if(action != "No_Hands"){

            if(actionList.length == 0 && action != "None" && action != "Open_Palm" && action != "Closed_Fist" && action != "Pointing_Up" && action != "Pointing_Down"){
                actionList.push(action);
                isGestureTimeOut = true;
                gestureTimeoutClock.start();
                actionsToText(actionList);
            } 
            
            if(action == "Open_Palm"){
                processIndex(actionList);
                updateGestureText(`Teleported to: \n ${themes[themeIndex]}`);
            }
            
            if (!actionList.includes(action) && action != "None" && action != "Open_Palm" && action != "Closed_Fist" && action != "Pointing_Up" && action != "Pointing_Down"){
                actionList.push(action);
                isGestureTimeOut = true;
                gestureTimeoutClock.start();
                actionsToText(actionList);
            }

        }
        
    
    
    //console.log(actionList);

    
}

    fpsCamera.update(delta);
renderer.render( scene, camera );




    

}

// add confirm

var gestureToBinary = {
    "Thumb_Up": 1,
    "Thumb_Down": 2,
    "Victory": 4,
    "ILoveYou": 8,
}


async function processIndex(actionList){

    var totalIndex = 0;

    actionList.forEach((action)=>{
    
        totalIndex += gestureToBinary[action];
    })

    if(totalIndex > themes.length){
        totalIndex = themes.length-1;
    } 
    console.log(totalIndex);

    themeIndex = totalIndex;

    // add listner to update
    soundPlayer.load(`themes/${themes[themeIndex]}/sounds/${themes[themeIndex]}.wav`);
    var curTheme = `Current Theme: ${themes[themeIndex]}!`;

   

    themeTracker.innerHTML = curTheme;

    room2.updateTheme(themes[themeIndex])



    actionList.length = 0;
    changingScene = false;
}
       
var firingAnim;


document.addEventListener("fire", ()=>{

    if(!firingAnim?.isPlaying()){
        firingAnim = new TWEEN.Tween(gunModel.rotation).to({x:1},200).yoyo(true)
        .repeat(1)
        .easing(TWEEN.Easing.Cubic.InOut)
        .start()
        gunModel.updateMatrix();
        changingScene = true;
    }
});




