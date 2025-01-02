// import mediapipe 
import {
    FaceLandmarker, FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
  
/* 

Hand Track Helper Class 
    1. Initialize Model;
    2. Initialize Video;
    3. Get Results;


*/

// code developed myself based on code from: https://codepen.io/mediapipe-preview/pen/OJBVQJm

export class FaceTrackHelper {

    // global gestureRecognizer variable
    faceLandmarker;
    video;

    constructor(){
        // FIX ME: Remove or Add to this

        if(document.getElementById('video') !== null){
            this.video = document.getElementById('video');
        }

        this.expressionsToRecognize = new Map();

        // different expressions 
        this.expressionsToRecognize.set("Open", {categoryNames: ["jawOpen"], avgValue: 0})
        this.expressionsToRecognize.set("Smile", {categoryNames: ["mouthSmileLeft", "mouthSmileRight"], avgValue: 0})
        this.expressionsToRecognize.set("Frown", {categoryNames: ["mouthFrownLeft", "mouthFrownRight"], avgValue: 0})
        this.expressionsToRecognize.set("Kiss", {categoryNames: ["mouthPucker"], avgValue: 0})
        this.expressionsToRecognize.set("Pressed",  {categoryNames: ["mouthPressLeft", "mouthPressRight"], avgValue: 0})

 



        this.blendShapesToRecognize = new Map([
            ["jawOpen",0],
            ["mouthSmileLeft",0],
            ["mouthSmileRight",0],
            ["mouthFrownLeft",0],
            ["mouthFrownRight",0],
            ["mouthPucker", 0],
            ["mouthPressLeft", 0],
            ["mouthPressRight", 0]
        ])


        this.targetExpressions = [
            "jawOpen",
            "mouthSmileLeft",
            "mouthSmileRight",
            "mouthFrownLeft",
            "mouthFrownRight",
            "mouthPucker",
            "mouthPressLeft",
            "mouthPressRight"

        ]

    }


    async createFaceLandmarker() {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });

      }
   



    async initVideo(){

        this.video = await document.createElement('video')
        this.video.id = "video";
        this.video.setAttribute('width', 250);
        this.video.setAttribute('height', 250);
        this.video.autoplay = true;

        await document.body.appendChild(this.video)
        

        // enable video stream
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((stream) => {
            this.video.srcObject = stream;
        }).catch((err) => {
            console.log("An error occurred! " + err);
        });

        this.video.hidden = true;

    }

    async getFaceLandmarks(){
        
        const nowInMs = Date.now();




        var result = this.faceLandmarker.detectForVideo(this.video, nowInMs);

        // check if there is a face in the video frame
        if(typeof(result) != undefined){
            // check if there is a poseRecognized
            if(result.faceBlendshapes.length > 0){
                // result.faceBlendshapes[0].categories.forEach((res)=>{
                
                //     console.log(res);
                // }
                // )
             //   console.log(result.faceBlendshapes[0].categories);

               var targetShapes = result.faceBlendshapes[0].categories.filter((blendShape) => 
                    this.targetExpressions.includes(blendShape.categoryName)
                );


                var categoryMap = new Map();
                targetShapes.forEach((shape) => {
                    categoryMap.set(shape.categoryName, shape.score)
                })

               

                return this.convertToExpression(categoryMap);
            } else {
                return "No_Face"
            }
        } 
    }

    convertToExpression(targetShapes){
        this.expressionsToRecognize.forEach((value) => {
            value.avgValue = 0;

            value.categoryNames.forEach((category)=>{1
                
                value.avgValue += targetShapes.get(category);
            })

            value.avgValue = value.avgValue / value.categoryNames.length;

        })

        var closestExpression = [...this.expressionsToRecognize.entries()].reduce((left,right) => left[1].avgValue > right[1].avgValue ? left : right);
        
        // tweak and play around with this value
        if(closestExpression[1].avgValue < 0.5){
            return "None";
        } else {
            return closestExpression[0];
        }

        

;
    }

}

