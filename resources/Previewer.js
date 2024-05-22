import * as THREE from 'https://unpkg.com/three/build/three.module.js';
import { ColladaLoader } from '../ColladaLoader.js';

var startPath = 'https://coconutsxxs.github.io/Splatoon-Blender'
// startPath = '../'

Array.prototype.max = function() {
    return Math.max.apply(null, this);
};
Array.prototype.min = function() {
    return Math.min.apply(null, this);
};
async function wait(time)
{
    return new Promise((resolve) =>
    {
        setTimeout(resolve, time)
    });
}

function clearTotally()
{
    cancelAnimationFrame(lastRenderer.id);// Stop the animation
    lastRenderer.renderer.domElement.addEventListener('dblclick', null, false); //remove listener to render
    lastRenderer.scene = null;
    lastRenderer.projector = null;
    lastRenderer.camera = null;
    lastRenderer.controls = null;
    empty(lastRenderer.modelContainer);

    function empty(elem) {
        while (elem.lastChild) elem.removeChild(elem.lastChild);
    }
}

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
function teamColoredTexture(color='#FF0000', tcl, alb)
{
    var _c = document.createElement('canvas');
    _c.width = _c.height = 512;
    const _ctx = _c.getContext("2d");
    _ctx.fillStyle = color
    _ctx.fillRect(0, 0, 512, 512)

    _ctx.globalCompositeOperation = 'multiply';
    _ctx.drawImage(tcl, 0, 0, 512, 512)

    document.body.append(tcl)
    document.body.append(_c)
    // _ctx.restore();


    var c = document.createElement('canvas');
    c.width = c.height = 512*4;
    const ctx = c.getContext("2d");

    if(alb != undefined)
    {
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(alb, 0, 0, 512*4, 512*4)    
    }

    ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(_c, 0, 0, 512*4, 512*4)

    // Texture
    var albedo = new THREE.CanvasTexture(_c)
    albedo.needsUpdate = true;
    albedo.wrapS = THREE.RepeatWrapping;
    albedo.wrapT = THREE.RepeatWrapping;
    albedo.flipY = false;
    albedo.colorSpace = THREE.SRGBColorSpace

    return albedo
}
async function material(textures, path, material, name = '', color=0xe87d0d99, materialName='', otherPath = '')
{
    const textureLoader = new THREE.TextureLoader();

    // Material
    material = new THREE.MeshStandardMaterial()
    // ({
    //     // map: albedoMap,
    //     // transparent: opacityMap.source.data != null,
    //     // alphaHash: opacityMap.source.data != null,
    //     // normalMap: normalMap,
    //     // roughnessMap: roughnessMap,
    //     // metalnessMap: metalicMap,
    //     // emissiveMap: emissiveMap,
    //     // emissive: 0xFFFFFF,
    //     // alphaMap: opacityMap,
    //     // // alphaTest: 0.5,
    //     // aoMap: ambientOcclusionMap
    // });

    if(materialName.toLowerCase().includes('glass') || materialName.includes('FigureCases') || materialName.toLowerCase().includes('container'))
    {
        material.opacity = 0.3
        material.transparent = true
    }


    // Textures
    for(var t of textures)
    {
        var isVariation = false
        var variationIndex = '00'
        for (let i = 0; i < 100; i++)
        {
            if(i < 10){i = "0"+i}
            else{i = i.toString()}

            if(t.endsWith(i))
            {
                isVariation = true
                variationIndex = i
                break
            }
        }

        try
        {
            var texture = await textureLoader.loadAsync(path+t+'.png')
        }
        catch(err)
        {
            console.warn('First try, texture not found for material creation: ',err)
            try
            {
                var texture = await textureLoader.loadAsync(otherPath+t+'.png')
            }
            catch(err)
            {
                console.warn('Second try, texture not found for material creation: ',err)
            }
        }
        if(texture == undefined){continue}

        texture.colorSpace = THREE.NoColorSpace
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
    
        var suffix = t.split('_')[t.split('_').length-1]
        if(isVariation)
        {
            suffix = suffix.replace('.'+variationIndex, '')
        }
        suffix = suffix.split('.')[0]

        console.log(suffix)
        switch (suffix)
        {
            case 'Alb':
                texture.colorSpace = THREE.SRGBColorSpace
                material.map = texture
                break;
            case 'Mtl':
                material.metalnessMap = texture
                break;
            case 'Spc':
                material.specularnessMap = texture
                break;
                case 'Rgh':
                material.roughnessMap = texture
                break;
            case 'Opa':
                material.alphaMap = texture
                material.transparent = true
                break;
            case 'Emi':
                texture.colorSpace = THREE.SRGBColorSpace
                material.emissive = new THREE.Color(1, 1, 1);
                material.emissiveMap = texture
                break;
            case 'Emm':
                texture.colorSpace = THREE.SRGBColorSpace
                material.emissive = color;
                material.emissiveMap = texture
                break;
            case 'Nrm':
                material.normalMap = texture
                break;
            case 'Ao':
                material.aoMap = texture
                break;
        
            default:
                break;
        }
    }

    // Special
    if(name.toLowerCase().startsWith('fig_coop'))
    {
        material.color = new THREE.Color( 0X01410f )
        // material.color = new THREE.Color(0.0, 1, 0.0)
        material.roughness = 0.3
    }

    console.log(material)
    return material
}
function asyncCollada(modelPath)
{
    return new Promise((resolve) =>
    {
        var colladaLoader = new ColladaLoader();

        colladaLoader.load(modelPath, async (collada) => {resolve(collada)});
    })
}
async function loadModel(name, scene, camera, adjustFactor = 1)
{
    var path = startPath+'/resources/'+window.directory+name+'/';
    const center = new THREE.Object3D();
    scene.add(center)

    const isVariation = name.includes('_ShareTex_')
    const isCustom = name.includes('_Cstm')

    console.log('LOAD ' + name)
    console.log('is a variation: '+isVariation)

    var colladaLoader = new ColladaLoader();
    var modelPath = path+name+".dae"

    let variationIndex = '00'
    if(isVariation)
    {
        variationIndex = name.charAt(name.indexOf('_ShareTex_')+10)+name.charAt(name.indexOf('_ShareTex_')+11)

        path = startPath+'/resources/'+window.directory+name.slice(0, -12)+'/'
        modelPath = path+name.slice(0, -12)+".dae"

        if((await asyncCollada(modelPath)) == null)
        {
            modelPath = path+name.slice(0, -12)+"00.dae"
        }    

        console.log('Base model base: '+modelPath)
    }
    else
    {
        if((await asyncCollada(modelPath)) == null)
        {
            modelPath = path+name+"00"+".dae"
        }    
        if((await asyncCollada(modelPath)) == null)
        {
            modelPath = path+name+"_00"+".dae"
        }    
    }
    console.log(modelPath)

    return new Promise(async (resolve) =>
    {    
        colladaLoader.load(modelPath, async (collada) =>
        {
            if(collada == null || collada.scene == null){resolve([]); console.log("Missing .dae file")}
            const model = collada.scene;
    
    
            let textures = []
            for(var i of Object.entries(collada.library.images))
            {
                textures.push(i[0])
            }
            let materials = []
            for(var i of Object.entries(collada.library.materials))
            {
                materials.push(i[0])
            }

            // Bounding
            let allDimensionsX = []
            let allDimensionsY = []
            let allDimensionsZ = []
            let allHeight = []

            let usedMaterials = []

            for(var child of model.children)
            {
                var box3 = new THREE.Box3().setFromObject( child );
                if(box3.max.x != Infinity && box3.max.x != -Infinity && box3.min.x != Infinity && box3.min.x != -Infinity)
                {
                    allDimensionsX.push(box3.max.x - box3.min.x)
                }
                if(box3.max.y != Infinity && box3.max.y != -Infinity && box3.min.y != Infinity && box3.min.y != -Infinity)
                {
                    allDimensionsY.push(box3.max.y - box3.min.y)
                }
                if(box3.max.z != Infinity && box3.max.z != -Infinity && box3.min.z != Infinity && box3.min.z != -Infinity)
                {
                    allDimensionsZ.push(box3.max.z - box3.min.z)
                }

                allHeight.push(box3.max.y)

                if(child.material != undefined)
                {
                    let materialName = Object.entries(collada.library.materials).find(m => m[1].build == child.material)[0]

                    if(usedMaterials.includes(materialName)){continue}

                    console.log('Material: '+materialName)

                    // let isMaterialVariation = materialName.includes(variationIndex) && isVariation


                    console.log('Textures: ', textures)
                    let objectTextures = []
                    for(var t of textures)
                    {
                        if(t.slice(0, -4) == materialName){ objectTextures.push(t); continue }
                        for(var w of t.split('_'))
                        {
                            if(w == materialName){ objectTextures.push(t); continue }
                        }
                    }

                    if(materialName.toLowerCase().startsWith('m_')){materialName=materialName.slice(2)}
                    if(materialName.toLowerCase().startsWith('obj_')){materialName=materialName.slice(4)}   
                    if(materialName.toLowerCase().endsWith('plastic')){materialName=materialName.slice(0, -7)}   
                    
                    for(var t of textures)
                    {
                        let a = t
                        t = t.replace('_BGOBJ', '');
                        t = t.replace('_F', '')
                        if(t == materialName){ objectTextures.push(t); continue }
                        console.log(t)
                        for(var w of t.split('_'))
                        {
                            if(w == materialName){ objectTextures.push(a); continue }
                        }
                    }

                    objectTextures = objectTextures.sort()

                    if(isVariation)
                    {
                        for (let i = 0; i < 100; i++)
                        {
                            if(i < 10){i = "0"+i}
                            else{i = i.toString()}

                            if(i == variationIndex){continue}

                            for (let index = 0; index < objectTextures.length; index++)
                            {
                                if(objectTextures[index].includes(i)){objectTextures.splice(index, 1);}
                                
                            }
                        }

                        objectTextures = objectTextures.reverse()
                    }
                    objectTextures=objectTextures.reverse()

                    var texPath = path
                    if(isVariation)
                    {
                        texPath = startPath+'/resources/'+window.directory+name+'/'
                        // texPath = startPath+'/resources/'+window.directory+name.slice(0, -7)+'/'
                    }
                    else if(isCustom)
                    {
                        texPath = startPath+'/resources/'+window.directory+name.slice(0, -7)+'/'
                    }

                    console.log(texPath)
                    console.log(path)
                    console.log(objectTextures)

                    child.material = await material(objectTextures, texPath, child.material, name, 0x000000, materialName, path)
                    usedMaterials.push(materialName)
                }
            }
            var i=0
            var bound=0;
            // for(var a of allDimensions){if(a == Infinity || a == -Infinity){continue} bound+=a; i++ }
            bound/=i
            bound = Math.max(allDimensionsX.max(), allDimensionsY.max(), allDimensionsZ.max())
            
            i=0
            var height = 0
            for(var a of allHeight){ if(a == Infinity || a == -Infinity){continue}console.log(a); height+=a; i++ }
            height/=i

            scene.add(center)
            center.add(collada.scene)
    
            collada.scene.position.set(0, -height, 0)
            center.position.set(0, height/2, 0)
    
            camera.position.set(0, 0, bound / 2 / Math.tan(Math.PI * 30 / 360)*adjustFactor);

            resolve(textures)
        });    
    })
}
async function loadScene(canvas)
{
    // Setup Environnement
    const scene = new THREE.Scene();
    // scene.background = new THREE.Color(0X2f2f2f)

    // Create Camera
    const camera = new THREE.PerspectiveCamera(40, (canvas.width / canvas.height));
    camera.position.set(0, 0, 3);

    // Create Light
    const lightLeft = new THREE.DirectionalLight(0xFFFFFF, 3);
    scene.add(lightLeft);
    lightLeft.position.set(0, 100, 20);
    lightLeft.rotation.y = -20;
    lightLeft.rotation.z = -90;

    const lightRight = new THREE.DirectionalLight(0xFFFFFF, 3);
    scene.add(lightRight);
    lightRight.position.set(0, -70, 20);
    lightRight.rotation.y = 200;
    lightRight.rotation.z = -90;

    const lightBack1 = new THREE.DirectionalLight(0xFFFFFF, 1);
    scene.add(lightBack1);
    lightBack1.position.set(-10, -80, -20);
    lightBack1.rotation.y = 200;
    lightBack1.rotation.x = 20;
    lightBack1.rotation.z = 90;

    const lightBack2 = new THREE.DirectionalLight(0xFFFFFF, 1);
    scene.add(lightBack2);
    lightBack2.position.set(10, 10, -20);
    lightBack2.rotation.y = 90;
    lightBack2.rotation.x = 180;
    lightBack2.rotation.z = 90;

    scene.add(new THREE.AmbientLight(0xFFFFFF, 2));

    // Create Mesh
    const center = new THREE.Object3D();
    scene.add(center)
    center.rotation.set(0.3, 0.3, 0)


    // Render
    const renderer = new THREE.WebGLRenderer({ precision: 'lowp', powerPreference: 'low-power', antialias: true, alpha: true, canvas: canvas, failIfMajorPerformanceCaveat: true });

    renderer.setSize( canvas.width, canvas.height )
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
    var first = true

    // loop();
    function loop()
    {
        renderer.render(scene, camera);

        // if(click){requestAnimationFrame(loop);}
    }

    let sensibility = 0.3;
    document.body.addEventListener('mousemove', function(event)
    {
        if(click)
        {
            center.rotation.y = center.rotation.y+(event.clientX - oldX)/20*sensibility;
            center.rotation.x = center.rotation.x+(event.clientY - oldY)/40*sensibility;

            loop()
        }

        oldX = event.clientX;
        oldY = event.clientY;
    })

    canvas.addEventListener('mousedown', () => {click = true; loop()})
    canvas.addEventListener('mouseup', () => {click = false;})
    document.addEventListener('mouseup', () => {click = false;})
    document.addEventListener('mouseleave', () => {click = false;})

    function destroy()
    {
        scene.remove(scene.children[0]);
        renderer.clear()
        renderer = null
    }

    wait(300).then(() => click = true)

    return {scene: center, camera: camera, loop: loop, destroy:destroy, renderer:renderer}
}
window.loadScene = loadScene
window.loadModel = loadModel


function getAverage(imgEl)
{
    var blockSize = 5, // only visit every 5 pixels
        defaultRGB = {r:0,g:0,b:0}, // for non-supporting envs
        canvas = document.createElement('canvas'),
        context = canvas.getContext && canvas.getContext('2d'),
        data, width, height,
        i = -4,
        length,
        rgb = {r:0,g:0,b:0},
        count = 0;

    if (!context) {
        return defaultRGB;
    }

    height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
    width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;

    context.drawImage(imgEl, 0, 0);

    try {
        data = context.getImageData(0, 0, width, height);
    } catch(e) {
        /* security error, img on diff domain */
        return defaultRGB;
    }

    length = data.data.length;

    while ( (i += blockSize * 4) < length ) {
        ++count;
        rgb.r += data.data[i];
        rgb.g += data.data[i+1];
        rgb.b += data.data[i+2];
    }

    // ~~ used to floor values
    rgb.r = ~~(rgb.r/count);
    rgb.g = ~~(rgb.g/count);
    rgb.b = ~~(rgb.b/count);

    return rgbToHex(rgb);
}
function rgbToHex(rgb)
{
    return "#" + (1 << 24 | rgb.r << 16 | rgb.g << 8 | rgb.b).toString(16).slice(1);
}
