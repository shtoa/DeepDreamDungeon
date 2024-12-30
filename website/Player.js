import { FirstPersonCamera } from "./FirstPersonCamera";
import {GunController} from "./GunController";

export class Player{

    constructor(){
        
        this.playerCamera = new FirstPersonCamera();
        this.gunController = new GunController();
    
    }

}