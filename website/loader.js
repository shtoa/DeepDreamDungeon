  

			const loader = new FBXLoader.FBXLoader();
   
            loader.load( 'idle3.fbx', function ( object ) {
                  
                      
             
              var mixer2 = new THREE.AnimationMixer( object );
                      
              const action = mixer2.clipAction( object.animations[ 3 ] );
      
                animationsMap2["walk"] = mixer2.clipAction( object.animations[ 0 ] );
                animationsMap2["flip"] = mixer2.clipAction( object.animations[ 1 ] );
                animationsMap2["idle"] = mixer2.clipAction( object.animations[ 3 ] );
                animationsMap2["run"] = mixer2.clipAction( object.animations[ 2 ] );
                animationsMap2["slide"] = mixer2.clipAction( object.animations[ 6 ] );
      
                
                animationsMap2["flip"].setLoop(THREE.LoopOnce)
                animationsMap2["slide"].setLoop(THREE.LoopOnce)
      
                for(let k in animationsMap){
                  animationsMap[k].clampWhenFinished = true;
                }
                
      
                      action.play();
                      
                      object.traverse( function ( child ) {
                          
                          if ( child.isMesh ) {
                              
                              child.castShadow = true;
                              child.receiveShadow = true;
                              
                  //object.scale.set(40,40,40)
                 
                          
                          }
                          } );
                  const scale = 2.5
                  object.scale.set(scale,scale,scale);
        
                  playerModel = object;
               
      
                              scene.add( object ); // add playermodel to scene
      
      
                  //characterControls = new CharacterControls(playerModel, mixer2, animationsMap2,controls, camera, dirLight, "idle");
             
                  
             
      
                  } );
      