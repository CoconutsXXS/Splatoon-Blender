const bundledLanguageSources = {
    USen: "./resources/i18n/USen.json",
    CNzh: "./resources/i18n/CNzh.json",
    JPja: "./resources/i18n/JPja.json",
}

const languageSources = bundledLanguageSources

const browserLocales = {
    USen: "en",
    CNzh: "zh-CN",
    JPja: "ja-JP",
}

const interfaceText = {
    USen: {
        language: "Language",
        previewerNote: "Model previewer doesn't support team color texture modification, result can be black/white. It's a quick automatic shader recreation, result is usually better when imported in Blender.",
        addon: "Add-On",
        documentation: "Doc & Tuto",
        inkColors: "Ink Colors",
        importTitle: "Import any model in 10 seconds!",
        importSteps: "- Download the model with the arrow button<br>- Unzip (open) the downloaded file<br>- In Blender go to File &gt; Import &gt; Splatoon Model and choose your file",
        addonPrefix: "Download the ",
        addonLink: "Splatoon Model Importer",
        addonSuffix: " Blender add-on.",
        title: "Splatoon Resources",
        previousSection: "Previous category",
        nextSection: "Next category",
    },
    CNzh: {
        language: "语言",
        previewerNote: "模型预览器不支持队伍颜色贴图修改，预览结果可能呈黑白效果。此处使用了快速自动着色器重建，导入 Blender 后通常会有更好的效果。",
        addon: "插件",
        documentation: "文档与教程",
        inkColors: "墨水颜色",
        importTitle: "10 秒内导入任意模型！",
        importSteps: "- 点击箭头按钮下载模型<br>- 解压下载的文件<br>- 在 Blender 中选择 文件 &gt; 导入 &gt; Splatoon Model，然后选择模型文件",
        addonPrefix: "下载 Blender 插件：",
        addonLink: "Splatoon Model Importer",
        addonSuffix: "。",
        title: "Splatoon 资源",
        previousSection: "上一个分类",
        nextSection: "下一个分类",
    },
    JPja: {
        language: "言語",
        previewerNote: "モデルプレビューではチームカラーのテクスチャ変更に対応していないため、白黒で表示される場合があります。簡易的な自動シェーダー再現のため、Blenderに読み込むと通常はより良い結果になります。",
        addon: "アドオン",
        documentation: "ドキュメント・チュートリアル",
        inkColors: "インクカラー",
        importTitle: "10秒で好きなモデルをインポート！",
        importSteps: "- 矢印ボタンでモデルをダウンロード<br>- ダウンロードしたファイルを解凍<br>- Blenderで「ファイル」&gt;「インポート」&gt;「Splatoon Model」を選び、ファイルを指定",
        addonPrefix: "Blenderアドオン「",
        addonLink: "Splatoon Model Importer",
        addonSuffix: "」をダウンロード。",
        title: "Splatoon リソース",
        previousSection: "前のカテゴリ",
        nextSection: "次のカテゴリ",
    },
}

const sectionNames = {
    "Locker/": { USen: "Locker Models", CNzh: "储物柜物品模型", JPja: "ロッカーグッズモデル" },
    "Head/": { USen: "Head Gear Models", CNzh: "头部装备模型", JPja: "アタマギアモデル" },
    "Cloth/": { USen: "Cloth Models", CNzh: "服装模型", JPja: "フクギアモデル" },
    "Shoes/": { USen: "Shoes Models", CNzh: "鞋子模型", JPja: "クツギアモデル" },
    "Weapons/": { USen: "Weapon Models", CNzh: "武器模型", JPja: "ブキモデル" },
    "Character/": { USen: "Characters", CNzh: "角色", JPja: "キャラクター" },
}

const gearGroups = {
    "Head/": "CommonMsg/Gear/GearName_Head",
    "Cloth/": "CommonMsg/Gear/GearName_Clothes",
    "Shoes/": "CommonMsg/Gear/GearName_Shoes",
}

const languageCache = new Map()
const languageSelect = document.getElementById("resource-language")
let currentLocale = detectLocale()
let currentDictionary = {}

function detectLocale() {
    try {
        const savedLocale = window.localStorage.getItem("resources-locale")
        if (savedLocale in languageSources) return savedLocale
    } catch {
        // Storage can be disabled; use the browser's language instead.
    }

    for (const locale of navigator.languages || [navigator.language]) {
        if (/^zh/i.test(locale)) return "CNzh"
        if (/^ja/i.test(locale)) return "JPja"
    }
    return "USen"
}

function readTranslation(group, key) {
    const value = currentDictionary?.[group]?.[key]
    return typeof value === "string" && value.trim() && value.trim() !== "-"
        ? value.trim()
        : null
}

function getGearName(name, directory) {
    const group = gearGroups[directory]
    const code = name.match(/^([A-Z]{3}\d{3})/i)?.[1]
    return group && code ? readTranslation(group, code) : null
}

function getLockerName(name) {
    const baseId = name.replace(/_ShareTex_\d+$/, "")
    return readTranslation("CommonMsg/Goods/GoodsName", baseId)
}

function getWeaponName(name) {
    const group = "CommonMsg/Weapon/WeaponName_Main"
    const names = currentDictionary?.[group]
    if (!names) return null

    const id = name.replace(/^Wmn_/, "").replace(/\.$/, "")
    const candidates = []
    const add = candidate => {
        if (candidate && !candidates.includes(candidate)) candidates.push(candidate)
    }

    add(id)
    add(id + "_00")

    const custom = id.match(/^(.*)_Cstm(\d{2})$/)
    if (custom) {
        add(custom[1] + "_" + custom[2])
        add(custom[1] + "_0" + custom[2][1])
        add(custom[1] + "_00")
    }

    const coop = id.match(/^(.*)_Coop$/)
    if (coop) {
        add(coop[1] + "_Bear_Coop")
        add(coop[1] + "_Coop")
    }

    const splatsville = id.match(/^(.*)_NormalSdodr$/)
    if (splatsville) {
        add(splatsville[1] + "_Sdodr")
        const matchingKey = Object.keys(names).find(key =>
            key.startsWith(splatsville[1] + "_") && key.endsWith("_Sdodr")
        )
        add(matchingKey)
    }

    const aliasSource = custom ? custom[1] : id
    const aliases = [
        [/_NormalTScope$/, "_NormalScope"],
        [/_NormalT$/, "_Normal"],
        [/_Msn0Lv0$/, "_MissionNormalLv0"],
        [/_RvLv0$/, "_RivalLv1_00"],
        [/_RvSdodr$/, "_RivalSdodr"],
    ]
    for (const [pattern, replacement] of aliases) {
        if (pattern.test(aliasSource)) {
            const alias = aliasSource.replace(pattern, replacement)
            if (custom) {
                add(alias + "_" + custom[2])
                add(alias + "_0" + custom[2][1])
            }
            add(alias)
            add(alias + "_00")
        }
    }

    for (const candidate of candidates) {
        const value = readTranslation(group, candidate)
        if (value) return value
    }
    return null
}

function updateInterface(locale) {
    const text = interfaceText[locale]
    document.documentElement.lang = browserLocales[locale]
    document.title = text.title
    languageSelect.setAttribute("aria-label", text.language)
    document.getElementById("previous-section").setAttribute("aria-label", text.previousSection)
    document.getElementById("next-section").setAttribute("aria-label", text.nextSection)
    document.getElementById("previewer-note").textContent = text.previewerNote
    document.getElementById("addon-button").textContent = text.addon
    document.getElementById("documentation-button").textContent = text.documentation
    document.getElementById("ink-colors-button").textContent = text.inkColors
    document.getElementById("import-instructions-title").textContent = text.importTitle
    document.getElementById("import-instructions-steps").innerHTML = text.importSteps

    const addonText = document.getElementById("import-addon-text")
    const addonLink = addonText.querySelector("a")
    addonLink.textContent = text.addonLink
    addonText.replaceChildren(
        document.createTextNode(text.addonPrefix),
        addonLink,
        document.createTextNode(text.addonSuffix),
    )
}

function refreshResourcePage() {
    window.updateResourceSection?.()
}

window.resourceI18n = {
    getLocale: () => currentLocale,
    getSectionName(directory, fallback) {
        return sectionNames[directory]?.[currentLocale] || fallback
    },
    getItemName(name, directory) {
        if (directory in gearGroups) return getGearName(name, directory)
        if (directory === "Weapons/") return getWeaponName(name)
        if (directory === "Locker/") return getLockerName(name)
        return null
    },
}

async function changeLocale(locale) {
    currentLocale = locale in languageSources ? locale : "USen"
    const requestedLocale = currentLocale
    languageSelect.value = currentLocale
    updateInterface(currentLocale)
    languageSelect.dispatchEvent(new Event("language-picker-sync"))
    window.dispatchEvent(new CustomEvent("resource-locale-change", { detail: currentLocale }))

    try {
        window.localStorage.setItem("resources-locale", currentLocale)
    } catch {
        // The selected locale still applies for this page visit.
    }

    try {
        let dictionary = languageCache.get(currentLocale)
        if (!dictionary) {
            const response = await fetch(languageSources[currentLocale])
            if (!response.ok) throw new Error("Language data request failed: " + response.status)
            dictionary = await response.json()
            languageCache.set(currentLocale, dictionary)
        }
        if (requestedLocale !== currentLocale) return
        currentDictionary = dictionary
    } catch (error) {
        if (requestedLocale !== currentLocale) return
        console.warn("Could not load resource translations.", error)
        currentDictionary = {}
    }

    refreshResourcePage()
}

languageSelect.value = currentLocale
languageSelect.addEventListener("change", () => changeLocale(languageSelect.value))
window.addEventListener("storage", event => {
    if (event.key === "resources-locale") changeLocale(detectLocale())
})
changeLocale(currentLocale)
