// Importer Three.js
import * as THREE from 'three';
import { randInt } from 'three/src/math/MathUtils.js';

// Créer une scène
const scene = new THREE.Scene();

// Créer une caméra
const camera = new THREE.PerspectiveCamera(75, discord_canvas.width / discord_canvas.height, 0.1, 1000);
camera.position.set(0, 0, 8.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: discord_canvas });
renderer.setSize(discord_canvas.width, discord_canvas.height);
document.body.appendChild(renderer.domElement);

var group = new THREE.Group();
scene.add(group);
const light = new THREE.DirectionalLight(0xFFFFFF, 3);
group.add(light);
light.position.set(0, 20, 20);
light.rotation.y = 180;
light.rotation.z = -50;

const l = new THREE.DirectionalLight(0xFFFFFF, 1);
scene.add(l);
l.position.set(0, 20, 20);
l.rotation.y = 0;
l.rotation.z = -50;

const splash = []
const colors = [0xFEE75C, 0x57F287, 0xEB459E, 0xED4245, 0x5865F2]
var lastR = 0

const textureLoader = new THREE.TextureLoader();
window.addSplash = function addSplash(index=0, posX, posY)
{
    const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);

    const alpha = textureLoader.load('./ink_texture/alpha.png');
    const normal = textureLoader.load('./ink_texture/normal.png');

    var uvs = geometry.attributes.uv.array;
    for ( var i = 0, len=uvs.length; i<len; i++ )
    {
        uvs[i] *= 0.0721;
    }

    normal.offset.x = alpha.offset.x = 0.011+(index*1/12)
    normal.offset.y = alpha.offset.y = 0.64

    var colorR = randInt(0, 4)
    while(colorR == lastR)
    {
        colorR = randInt(0, 4)
    }
    lastR = colorR

    const material = new THREE.MeshStandardMaterial
    ({
        alphaMap: alpha,
        transparent: false,
        alphaTest: 1,
        normalMap: normal,
        side: 2,
        color: colors[colorR],
        roughness: 0.3
    });

    splash.push(material)

    const plane = new THREE.Mesh(geometry, material);
    plane.receiveShadow = false
    plane.translateX(posX)
    plane.translateY(posY)
    var r = 1+Math.random()/2
    plane.scale.set(r,r,r)
    scene.add(plane);
}

const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
const material = new THREE.MeshStandardMaterial
({
    alphaMap: textureLoader.load('./ink_texture/logo_alpha.png'),
    transparent: false,
    alphaTest: 0.8,
    normalMap: textureLoader.load('./ink_texture/logo_normal.png'),
    side: 0,
    color: colors[4],
    roughness: 0.3
});
const plane = new THREE.Mesh(geometry, material);
plane.scale.set(5,5,5)
plane.translateZ(-0.1)
scene.add(plane)

console.log(colors[4])

let t = 0
const clock = new THREE.Clock();


let targetLookX = 0;
let targetLookY = 0;
var oldX = null;
var oldY = null;
Math.lerp = function (start, end, amt)
{
    return (1-amt)*start+amt*end
}
function animate()
{
    t+=clock.getDelta()
    requestAnimationFrame(animate);
    renderer.render(scene, camera);

    group.rotation.y = Math.lerp(group.rotation.y, targetLookX, 0.05);
    group.rotation.x = Math.lerp(group.rotation.x, targetLookY, 0.05);


    for(var i in splash)
    {
        if(splash[i].alphaTest > 0.1) { splash[i].alphaTest -= 0.1 }
        if(splash[i].alphaTest < 0.1){ splash[i].alphaTest = 0.1 }    
    }
}
animate();

document.getElementById('discord_splash').appendChild(renderer.domElement)

document.body.addEventListener('mousemove', function(event)
{
    targetLookX = group.rotation.y+(event.clientX - oldX)/150;
    targetLookY = group.rotation.x+(event.clientY - oldY)/75;

    oldX = event.clientX;
    oldY = event.clientY;
})