import * as THREE from 'three';
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
var loader = new THREE.ImageLoader();
scene.environment = loader.load('./custom_tee/Sky.jpg');

// Create Camera
const camera = new THREE.PerspectiveCamera(60, (window.tee_customizer.width / window.tee_customizer.height));
camera.position.set(0, 0.15, 1.6);

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

const lightBack1 = new THREE.DirectionalLight(0xFFFFFF, 1);
scene.add(lightBack1);
lightBack1.position.set(-10, -10, -20);
lightBack1.rotation.y = 200;
lightBack1.rotation.x = 20;
lightBack1.rotation.z = 90;

const lightBack2 = new THREE.DirectionalLight(0xFFFFFF, 1);
scene.add(lightBack2);
lightBack2.position.set(10, 10, -20);
lightBack2.rotation.y = 90;
lightBack2.rotation.x = 180;
lightBack2.rotation.z = 90;

scene.add(new THREE.AmbientLight(0xFFFFFF, 1));
// scene.add(new THREE.AmbientLight(0xFFFFFF, 1));

// Create Mesh
const center = new THREE.Object3D();
scene.add(center)

async function loadImage(path)
{
    return new Promise((resolve, reject) =>
    {
        var img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function()
        {
            resolve(img)
        }
        img.src = path;
    })
}

function rotateAndPaintImage(context, image, angleInRad , positionX, positionY, scaleX, scaleY, axisX, axisY)
{
    context.translate( positionX, positionY );
    context.rotate( angleInRad );
    context.drawImage( image, -axisX, -axisY, scaleX, scaleY );
    context.rotate( -angleInRad );
    context.translate( -positionX, -positionY );
}
async function teamColoredTexture(tcl='#FF0000', image, team, teamImage)
{
    var size = window.teeLogoSize*500

    var _c = document.createElement('canvas');
    _c.width = _c.height = 512

    const _ctx = _c.getContext("2d");
    var img = await loadImage(new URL('./custom_tee/Tee Team Color.png', document.baseURI).href)
    _ctx.fillStyle = tcl
    _ctx.globalAlpha = 1
    _ctx.fillRect(0, 0, 512, 512)
    _ctx.globalCompositeOperation = 'destination-out';
    _ctx.drawImage(img, 0, 0, 512, 512)
    _ctx.restore();


    var c = document.createElement('canvas');
    c.width = c.height = 512*4;
    const ctx = c.getContext("2d");
    img = await loadImage(new URL('./custom_tee/Tee Blank.png', document.baseURI).href)

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(await loadImage(new URL('./custom_tee/Tee Semi Blank.png', document.baseURI).href), 0, 0, 512*4, 512*4)

    ctx.fillStyle = tcl
    ctx.globalCompositeOperation = 'screen';
    ctx.fillRect(0, 0, 512*4, 512*4)

    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(await loadImage(new URL('./custom_tee/Tee Semi MAI.png', document.baseURI).href), 0, 0, 512*4, 512*4)

    ctx.globalCompositeOperation = 'destination-over';
    ctx.drawImage(img, 0, 0, 512*4, 512*4)

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(_c, 0, 0, 512*4, 512*4)
    if(image != undefined)
    {
        ctx.drawImage(await loadImage(image), 512*4*0.15-size/2, 512*4*0.16-size/2, 512*4*0.15+size, 512*4*0.15+size)
    }

    // ctx.drawImage(await loadImage(window.location+team+'.png'), 512*4*0.87, 512*4*0.665, 512*4*0.05, 512*4*0.05)
    var teamIcon = undefined
    if(team == 'custom')
    {
        teamIcon = await loadImage(teamImage);
    }
    else
    {
        teamIcon = await loadImage(new URL('./custom_tee/'+team+'.png', document.baseURI).href);
    }

    ctx.drawImage(teamIcon, 512*4*0.577, 512*4*0.135, 512*4*0.11, 512*4*0.11)

    rotateAndPaintImage(ctx, teamIcon, 90*Math.PI/180, 512*4*0.91, 512*4*0.66, 512*4*0.05, 512*4*0.05, 0, 0)

    // Texture
    var albedo = new THREE.CanvasTexture(c)
    albedo.needsUpdate = true;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.wrapT = THREE.RepeatWrapping;
    albedo.flipY = false;
    albedo.colorSpace = THREE.SRGBColorSpace

    return albedo
}
window.teeLogoSize = 0
window.teamColoredTexture = teamColoredTexture

const textureLoader = new THREE.TextureLoader();

var roughnessMap = textureLoader.load('./custom_tee/Tee Roughness.png')
roughnessMap.flipY = false;
roughnessMap.colorSpace = THREE.NoColorSpace

var normalMap = textureLoader.load('./custom_tee/Tee Normal Map.png')
normalMap.flipY = false;
roughnessMap.colorSpace = THREE.NoColorSpace

var emissiveMap = textureLoader.load('./custom_tee/Tee Emission.png')
emissiveMap.flipY = false;
emissiveMap.colorSpace = THREE.SRGBColorSpace

var lastTtype = ''
window.updateTee = async function(color = "#FF0000", image, type = 'F', team='Big Man', teamImage)
{
    // Textures
    var albedo = await teamColoredTexture(color, image, team, teamImage)
    
    // Mesh
    if(lastTtype != type)
    {
        // Material
        const material = new THREE.MeshStandardMaterial
        ({
            map: albedo,
            transparent: false,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            emissiveMap: emissiveMap,
            emissive: color
        });
        
        const teeScene = await loadScene("./custom_tee/Tee "+type+".glb");

        for(var child of center.children)
        {
            center.remove(child)
        }
        for(var child of teeScene.children)
        {
            child.material = material
            center.add(child)
        }
    } 
    else
    {
        for(var child of center.children)
        {
            child.material.map = albedo
        }
    }
}
window.teeColor = document.getElementById('tee-color').value
window.teeSize = document.getElementById('tee-size').value
window.teeTeam = document.getElementById('tee-team').value

var file = undefined
if(document.getElementById('tee-image').files[0] != undefined){file = URL.createObjectURL(document.getElementById('tee-image').files[0])}
var file2 = undefined
if(document.getElementById('tee-image-team').files[0] != undefined){file2 = URL.createObjectURL(document.getElementById('tee-image-team').files[0])}
window.updateTee(window.teeColor, file, window.teeSize, window.teeTeam, file2)

// Render
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: tee_customizer });
renderer.setSize(window.tee_customizer.width * 2, window.tee_customizer.height * 2, false)
renderer.render(scene, camera);


Math.lerp = function (start, end, amt)
{
    return (1-amt)*start+amt*end
}


let targetLookX = 0;
let targetLookY = 0;
let targetCameraDistance = camera.position.z;
let dragPointerId = null;
let lastPointerX = 0;
let lastPointerY = 0;
const dragSensitivity = 0.006;
const minCameraDistance = 0.9;
const maxCameraDistance = 3.2;
const pinchZoomSensitivity = 0.005;
const wheelZoomSensitivity = 0.001;
const raycaster = new THREE.Raycaster();
const pointerPosition = new THREE.Vector2();

function isInteractiveTarget(target)
{
    return target instanceof Element && Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"]'));
}

function isPointerOverTee(event)
{
    const rect = window.tee_customizer.getBoundingClientRect();
    if(rect.width === 0 || rect.height === 0 ||
        event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom)
    {
        return false;
    }

    pointerPosition.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerPosition.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(pointerPosition, camera);
    return raycaster.intersectObjects(center.children, true).length > 0;
}

function stopTeeDrag()
{
    dragPointerId = null;
    document.body.style.removeProperty('cursor');
}

document.addEventListener('pointerdown', function(event)
{
    if(dragPointerId !== null || (event.pointerType === 'mouse' && event.button !== 0) ||
        isInteractiveTarget(event.target) || !isPointerOverTee(event))
    {
        return;
    }

    dragPointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    document.body.style.cursor = 'grabbing';
    if(event.cancelable) event.preventDefault();
}, {capture: true, passive: false});

document.addEventListener('pointermove', function(event)
{
    if(event.pointerId !== dragPointerId)
    {
        return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    targetLookX += deltaX * dragSensitivity;
    targetLookY = THREE.MathUtils.clamp(targetLookY + deltaY * dragSensitivity, -0.85, 1.2);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    if(event.cancelable) event.preventDefault();
}, {capture: true, passive: false});

document.addEventListener('pointerup', function(event)
{
    if(event.pointerId === dragPointerId) stopTeeDrag();
}, true);
document.addEventListener('pointercancel', function(event)
{
    if(event.pointerId === dragPointerId) stopTeeDrag();
}, true);
window.addEventListener('blur', stopTeeDrag);

document.addEventListener('wheel', function(event)
{
    if(!isPointerOverTee(event))
    {
        return;
    }

    const delta = THREE.MathUtils.clamp(event.deltaY, -250, 250);
    const sensitivity = event.ctrlKey ? pinchZoomSensitivity : wheelZoomSensitivity;
    targetCameraDistance = THREE.MathUtils.clamp(
        targetCameraDistance * Math.exp(delta * sensitivity),
        minCameraDistance,
        maxCameraDistance
    );
    if(event.cancelable) event.preventDefault();
}, {capture: true, passive: false});

loop();
function loop()
{
    renderer.render(scene, camera);

    center.rotation.y = Math.lerp(center.rotation.y, targetLookX, 0.1);
    center.rotation.x = Math.lerp(center.rotation.x, targetLookY, 0.1);
    camera.position.z = Math.lerp(camera.position.z, targetCameraDistance, 0.12);

    if(center.rotation.x < -0.85) { center.rotation.x = -0.85 }
    if(center.rotation.x > 1.2) { center.rotation.x = 1.2 }

    requestAnimationFrame(loop);
}
