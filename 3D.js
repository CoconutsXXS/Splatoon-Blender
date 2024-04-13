import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { GLTFLoader } from './GLTFLoader.js'


function asyncTimeout(time)
{
    return new Promise((resolve) =>
    {
        setTimeout(time, () => {resolve()})
    })
}
const loaderGlb = new GLTFLoader()
function loadScene(path)
{
    return new Promise((resolve, reject) => {
      loaderGlb.load(path,
        function(gltf) {
          resolve(gltf.scene)
        },
        undefined, function(e) {
          console.error(e)
          reject(e)
        })
    })
}

// Setup Environnement
const scene = new THREE.Scene();

// Create Camera
const camera = new THREE.PerspectiveCamera(90, iw / ih);
camera.position.set(0, 0, 4);

// Window Size
window.addEventListener('resize', onWindowResize, false);

function onWindowResize()
{
    // camera.aspect = document.getElementById("canvas").width / document.getElementById("canvas").height;
    // camera.updateProjectionMatrix();
    // renderer.setSize(document.getElementById("canvas").width, document.getElementById("canvas").height);
}

// Create Light
const lightLeft = new THREE.DirectionalLight(0xFFFFFF, 3);
scene.add(lightLeft);
lightLeft.position.set(0, 20, 20);
lightLeft.rotation.y = -20;
lightLeft.rotation.z = -90;

const lightRight = new THREE.DirectionalLight(0xFFFFFF, 3);
scene.add(lightRight);
lightRight.position.set(0, -20, 20);
lightRight.rotation.y = 200;
lightRight.rotation.z = -90;

const lightBack1 = new THREE.DirectionalLight(0xFFFFFF, 0.5);
scene.add(lightBack1);
lightBack1.position.set(-10, -10, -20);
lightBack1.rotation.y = 220;
lightBack1.rotation.x = 20;
lightBack1.rotation.z = 90;

const lightBack2 = new THREE.DirectionalLight(0xFFFFFF, 1);
scene.add(lightBack2);
lightBack2.position.set(10, 10, -20);
lightBack2.rotation.y = -220;
lightBack2.rotation.x = 20;
lightBack2.rotation.z = 90;

scene.add(new THREE.AmbientLight(0xFFFFFF, 1));
scene.add(new THREE.AmbientLight(0xFFFFFF, 1));

// Create Mesh
const center = new THREE.Object3D();
scene.add(center)

const characterScene = await loadScene("./Character.glb");
//center.add(characterScene)

function loadImage(path)
{
    return new Promise((resolve =>
    {
        new THREE.TextureLoader().load(path, (tex) => {resolve(tex)})
    }))
}

var i = 0
for(var child of characterScene.children)
{
    child.renderOrder = i
    center.add(child)
    child.position.y -= 0.5
    i++
}

// Render
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas });
renderer.render(scene, camera);


Math.lerp = function (start, end, amt)
{
    return (1-amt)*start+amt*end
}


let targetLookX = 0;
let targetLookY = 0;
var oldX = null;
var oldY = null;
let click = false;

loop();
function loop()
{
    renderer.render(scene, camera);

    center.rotation.y = Math.lerp(center.rotation.y, targetLookX, 0.1);
    center.rotation.x = Math.lerp(center.rotation.x, targetLookY, 0.1);

    if(center.rotation.x < -0.85) { center.rotation.x = -0.85 }
    if(center.rotation.x > 1.2) { center.rotation.x = 1.2 }

    requestAnimationFrame(loop);
}

Math.lerp = function (start, end, amt)
{
    return (1-amt)*start+amt*end
}
document.body.onmousemove = function(event)
{
    if(click)
    {
        targetLookX = center.rotation.y+(event.clientX - oldX)/20;
        targetLookY = center.rotation.x+(event.clientY - oldY)/40;    
    }

    oldX = event.clientX;
    oldY = event.clientY;
}

document.getElementById('canvas-box').onmousedown = () => {click = true;}
document.body.onmouseup = () => {click = false;}
document.body.onmouseleave = () => {click = false;}