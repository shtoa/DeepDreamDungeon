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

    generateCeiling(){

        var gm  = new THREE.PlaneGeometry( this._size.x, this._size.z );
        gm.rotateX(Math.PI/2);
        

        var ceiling = new THREE.Mesh( gm, new THREE.MeshPhongMaterial( ) );
  
        ceiling.position.set(this._center.x, this._center.y + (this._size.y/2), this._center.z);
        ceiling.receiveShadow = true;
        ceiling.material.map = new THREE.TextureLoader().load( `./themes/${this._curTheme}/dreamTextures/ceiling.png`);
        ceiling.material.needsUpdate = true;

      
        return ceiling
    }

    generateWalls(){

        // rename variables

        // left wall
        var lGM  = new THREE.PlaneGeometry( this._size.x, this._size.y );
        var leftWall = new THREE.Mesh( lGM, new THREE.MeshPhongMaterial( ) );
        leftWall.position.set(this._center.x, this._center.y, this._center.z - (this._size.z/2));
  
        // right wall
        var rGM  = new THREE.PlaneGeometry( this._size.x, this._size.y );
        rGM.rotateY(Math.PI)
        var rightWall = new THREE.Mesh( rGM, new THREE.MeshPhongMaterial(  ) );
        rightWall.position.set(this._center.x, this._center.y, this._center.z + (this._size.z/2));

        // front wall
        var fGM =  new THREE.PlaneGeometry( this._size.z, this._size.y);
        fGM.rotateY(-Math.PI/2)
        var frontWall = new THREE.Mesh( fGM, new THREE.MeshPhongMaterial(  ) );
        frontWall.position.set(this._center.x + (this._size.x/2), this._center.y, this._center.z);

        // back wall
        var bGM =  new THREE.PlaneGeometry( this._size.z, this._size.y);
        bGM.rotateY(Math.PI/2)
        var backWall = new THREE.Mesh(bGM, new THREE.MeshPhongMaterial(  ) );
        backWall.position.set(this._center.x - (this._size.x/2) , this._center.y, this._center.z);

        var walls = [leftWall, rightWall, frontWall, backWall];

        walls.forEach((wall)=>{
            wall.material.map = new THREE.TextureLoader().load( `./themes/${this._curTheme}/dreamTextures/wall.png`);
            wall.material.needsUpdate = true;
        })


        return walls;
    }

    generateFloor(){

        // generate floor geometry with normals facing upwards
        var gm  = new THREE.PlaneGeometry( this._size.x, this._size.z );
        gm.rotateX(-Math.PI/2);
       
        var floor = new THREE.Mesh( gm, new THREE.MeshPhongMaterial( ) );
      
        floor.position.set(this._center.x, this._center.y - (this._size.y/2), this._center.z);
        floor.receiveShadow = true;
        floor.material.map = new THREE.TextureLoader().load( `./themes/${this._curTheme}/dreamTextures/floor.png`);
        floor.material.needsUpdate = true;

      
        return floor
    }

    updateTheme(newTheme){

        // update theme to the new theme
        
        this._curTheme = newTheme;

        this._ceiling.material.map = new THREE.TextureLoader().load( `./themes/${this._curTheme}/dreamTextures/ceiling.png`);
        this._floor.material.map = new THREE.TextureLoader().load( `./themes/${this._curTheme}/dreamTextures/floor.png`);
        this._walls.forEach((wall)=>{
            wall.material.map = new THREE.TextureLoader().load( `./themes/${this._curTheme}/dreamTextures/wall.png`);
        })

    }

}