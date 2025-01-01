// DEEP DREAM DUNGEON


import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';


import {HandTrackHelper} from "./handTrackHelper.js" 
import {FirstPersonCamera} from "./FirstPersonCamera.js"
import {Room} from "./Room.js"

import { FBXLoader } from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/loaders/FBXLoader.js';
import {Text} from 'https://cdn.jsdelivr.net/npm/troika-three-text@0.52.0/+esm';
import { TWEEN } from 'https://unpkg.com/three@0.139.0/examples/jsm/libs/tween.module.min.js';
import { FaceTrackHelper } from './faceTrackHelper.js';

var camera, scene, renderer

export {renderer, scene};

const clock = new THREE.Clock();
const gestureTimeoutClock = new THREE.Clock();

// https://github.com/devinekask/creative-code-3-f24/blob/main/ml5/demos/03-handpose-vanilla-js.html

var themes = [];
var themeIndex = 0;

var handHelper;
var faceHelper;

var portalRoom;

const preload = async() =>{

    handHelper = new HandTrackHelper();
    await handHelper.initVideo();
    await handHelper.createGestureRecognizer();


    faceHelper = new FaceTrackHelper();
    await faceHelper.createFaceLandmarker();

    await fetch("/themes/themes.txt").then(res=> res.text()) // TODO: Move to backend
    .then(text=>{
        themes = text.split(/\r\n|\n/);
    });

    await setup();
   
}

const setup = async() =>{
    
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
var themeLabel = new Text();
var gestureLabel = new Text();
var room;
var room2;

var curRoom;

var soundPlayer;

var themeTracker;
var inputTracker;





function init() {
    // https://annakap.medium.com/integrating-ml5-js-posenet-model-with-three-js-b19710e2862b


    

    scene = new THREE.Scene();
    scene.userData.portalMask = new THREE.TextureLoader().load("./portalMask.png");
    scene.userData.changingScene = false;

    themeTracker = document.getElementById("currentTheme");
    inputTracker = document.getElementById("handInputs");
    

    const container = document.createElement( 'div' );
    document.body.appendChild( container );
    container.id = "snuggle"

    rect = document.getElementById("snuggle").getBoundingClientRect()

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.15, 500 );
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

    // helper for rooms
    //const helper = new THREE.Box3Helper( roomBounds, 0xffff00 );
    //scene.add( helper );

    room = new Room(roomBounds, themes[themeIndex]);


    // 400,110,0
    room2 = new Room(roomBounds.clone().translate(new THREE.Vector3(200,200,200)), themes[3]);
    curRoom = room;
    portalRoom = room2;
    
    scene.userData.portalableSurfaces = [];

    room.surfaces.forEach((surface)=>{
        scene.add(surface);
        scene.userData.portalableSurfaces.push(surface);

    })

    room2.surfaces.forEach((surface)=>{
        scene.add(surface);
        scene.userData.portalableSurfaces.push(surface);
    })


    scene.userData.curRoom = room;
    scene.userData.destinationRoom = room2;

    const grid = new THREE.GridHelper( 2000, 20, 0x000000, 0x000000 );
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add( grid );

    // model
    const loader = new FBXLoader();

    var canvas = document.createElement('canvas');
    canvas.id = "mainCanvas"

    canvas.onclick = ()=>{
        canvas.requestPointerLock(); // lock pointer to allow to look around
    }

    container.appendChild(canvas);

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true, canvas: canvas } );
    renderer.setClearColor( 0x000000, 0 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild( renderer.domElement );

    // position player in center 
    camera.position.set(room._center.x, room._center.y, room._center.z);

    fpsCamera = new FirstPersonCamera(camera, room, portalRoom);

    window.addEventListener( 'resize', onWindowResize, false );


    // sound

    soundPlayer = new Tone.Player(`themes/${themes[themeIndex]}/sounds/${themes[themeIndex]}.wav`) //.toDestination();
    soundPlayer.autostart = true;
    soundPlayer.loop = true;


    // text labels

    themeTracker.innerHTML = `Current Theme: ${themes[themeIndex]}!`;
    scene.add(themeLabel);

    updateGestureText("Gesture List: \n")

    // var testMesh = new THREE.Mesh( new THREE.BoxBufferGeometry( 30, 30, 30 ), new THREE.MeshPhongMaterial( ) );
    // testMesh.position.set(room._center.x, room._center.y, room._center.z);
    // testMesh.geometry.rotateX(Math.PI/4);
    // scene.add(testMesh);
   

    // testMesh.geometry.computeFaceNormals();
    // room.surfaces.push(testMesh);

    animate();

}

var fpsCamera;

function updateGestureText(text){
    // gestureLabel.dispose();
    // scene.remove(gestureLabel);
    // gestureLabel = new Text();
    
    gestureLabel.text = text;
    gestureLabel.fontSize = 8;
    gestureLabel.outlineWidth = "10%";
    gestureLabel.position.set(-100,100,0);
    gestureLabel.textAlign = "left";
    gestureLabel.anchorX = "left";
    gestureLabel.sync();

    inputTracker.innerHTML = text;

    // scene.add(gestureLabel);
}

function actionsToText(listOfActions){
    updateGestureText("")
    var text = "Gesture List: <br><ul>";
    var teleportToIndex = 0;

    listOfActions.forEach((action)=>{
        text += `<li> ${action} </li>`
        teleportToIndex += faceToBinary[action]; // gestureToBinary
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
var isGestureTimeOut = false;
var gestureTimeOut = 1;


// var unMappedActionsList = ["None", "Open_Palm", "Closed_Fist", "Pointing_Up", "Pointing_Down"]

var unMappedActionsList = ["Open", "None"]

function animate() {

    requestAnimationFrame( animate );

    const delta = clock.getDelta();

    scene.userData.globalDelta = delta;
    scene.userData.globalTime = clock.getElapsedTime();

    //controls.update()
    TWEEN.update();
   
    // handHelper.getPose()
    faceHelper.getFaceLandmarks().then(() => {

        if(gestureTimeoutClock.getElapsedTime() > gestureTimeOut){
        
            gestureTimeoutClock.stop();
            isGestureTimeOut = false;
        }

        if (scene.userData.changingScene && !isGestureTimeOut){
        

            //var action = handHelper.getPose()

            faceHelper.getFaceLandmarks().then((action)=>{
            
            // No_Hands
            if(action != "No_Face"){

                if(actionList.length == 0 && !unMappedActionsList.includes(action)){
                    actionList.push(action);
                    isGestureTimeOut = true;
                    gestureTimeoutClock.start();
                    actionsToText(actionList);
                } 
                
                // when to process 
                // if(action == "Open_Palm"){
                //     processIndex(actionList);
                //     updateGestureText(`Teleported to: \n ${themes[themeIndex]}`);
                // }
                
                if (!actionList.includes(action) && !unMappedActionsList.includes(action)){
                    actionList.push(action);
                    isGestureTimeOut = true;
                    gestureTimeoutClock.start();
                    actionsToText(actionList);
                }

            }

      

            })
            
        }

    })

    fpsCamera.update(delta);
    renderer.render( scene, camera );

}

document.addEventListener("fire",()=>{processIndex(actionList);});

// add confirm

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


    var curTheme = `Current Theme: ${themes[themeIndex]}!`;

   

    themeTracker.innerHTML = curTheme;

    scene.userData.destinationRoom.updateTheme(themes[themeIndex])


    // add listner to update
    // soundPlayer.load(`themes/${themes[themeIndex]}/sounds/${themes[themeIndex]}.wav`);



    actionList.length = 0;
    scene.userData.changingScene = false;
}
       

