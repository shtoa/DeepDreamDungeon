import * as THREE from 'https://cdn.skypack.dev/three@0.128.0/build/three.module.js';

export class Room {

    constructor(bounds, curTheme){

        this._roomThickness = 2;
        this._curTheme = curTheme;

        this._size = new THREE.Vector3();
        bounds.getSize(this._size);

        this._center = new THREE.Vector3();
        bounds.getCenter(this._center);

        this._ceiling = this.generateCeiling(bounds);
        this._walls = this.generateWalls(bounds);
        this._floor = this.generateFloor(bounds);
       
        this.surfaces = [this._ceiling, this._floor, ...this._walls];

        this.surfaces.forEach((surface)=>{
            surface.userData.bounds = new THREE.Box3().setFromObject(surface);
        })

        this.bounds = bounds;
    }

    generateCeiling(_){

        var ceiling = new THREE.Mesh( new THREE.BoxBufferGeometry( this._size.x, this._roomThickness, this._size.z ), new THREE.MeshPhongMaterial( ) );
        
        
        ceiling.position.set(this._center.x, this._center.y + (this._size.y/2) + this._roomThickness/4 , this._center.z);
        ceiling.receiveShadow = true;
        ceiling.material.map = new THREE.TextureLoader().load( `themes/${this._curTheme}/textures/ceiling.png`);
        ceiling.material.needsUpdate = true;
      

        return ceiling
    }

    generateWalls(_){

       

        // rename variables
        var leftWall = new THREE.Mesh( new THREE.BoxBufferGeometry( this._size.x, this._size.y, this._roomThickness ), new THREE.MeshPhongMaterial( ) );
        leftWall.position.set(this._center.x, this._center.y, this._center.z - (this._size.z/2) - this._roomThickness/4);
  


        var rightWall = new THREE.Mesh( new THREE.BoxBufferGeometry( this._size.x, this._size.y, this._roomThickness ), new THREE.MeshPhongMaterial(  ) );
        rightWall.position.set(this._center.x, this._center.y, this._center.z + (this._size.z/2) + this._roomThickness/4);


        var frontWall = new THREE.Mesh( new THREE.BoxBufferGeometry( this._roomThickness, this._size.y,  this._size.z), new THREE.MeshPhongMaterial(  ) );
        frontWall.position.set(this._center.x + (this._size.x/2) + this._roomThickness/4, this._center.y, this._center.z);

        var backWall = new THREE.Mesh( new THREE.BoxBufferGeometry( this._roomThickness, this._size.y, this._size.z), new THREE.MeshPhongMaterial(  ) );
        backWall.position.set(this._center.x - (this._size.x/2) - this._roomThickness/4, this._center.y, this._center.z);

        var walls = [leftWall, rightWall, frontWall, backWall];

        walls.forEach((wall)=>{
            wall.material.map = new THREE.TextureLoader().load( `themes/${this._curTheme}/textures/wall.png`);
            wall.material.needsUpdate = true;
        })


        return walls;
    }

    generateFloor(_){
       
        var floor = new THREE.Mesh( new THREE.BoxBufferGeometry( this._size.x, this._roomThickness, this._size.z ), new THREE.MeshPhongMaterial( ) );
        
        
        floor.position.set(this._center.x, this._center.y - (this._size.y/2) - this._roomThickness/4 , this._center.z);
        floor.receiveShadow = true;
        floor.material.map = new THREE.TextureLoader().load( `themes/${this._curTheme}/textures/floor.png`);
        floor.material.needsUpdate = true;
      

        return floor
    }

    updateTheme(newTheme){
        this._curTheme = newTheme;

        this._ceiling.material.map = new THREE.TextureLoader().load( `themes/${this._curTheme}/textures/ceiling.png`);
        this._floor.material.map = new THREE.TextureLoader().load( `themes/${this._curTheme}/textures/floor.png`);
        this._walls.forEach((wall)=>{
            wall.material.map = new THREE.TextureLoader().load( `themes/${this._curTheme}/textures/wall.png`);
        })

    }

}