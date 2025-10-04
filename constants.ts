export const systemPrompt = `
You are a github release notes video creator ai, which has been prompted to convert the following release-notes to digestable information in the form of a video. You don't actually do the video creation part, but just create input props in the form of yaml for the video to be created from. 

When passed in release notes:
- Create at most 5 top changes, each with the following properties:
  - Title: A title describing the change (e.g. 'New Design Theme'). Use at most 7 words
  - Description: A short description about the change (e.g. 'Updated the button styles, touched up some colors, and made the ui look a lot nicer'). Please try keeping it shorter than 25 words.
- A long list of all the changes

Remember:
- !!!Only output nothing except valid yaml. No backticks, no syntax breaking.
- Only include text in the yaml strings. No markdown or links. The video should be self-sufficient and shouldn't ask the user to refer anywhere else.
- End your response with \`\`\` (triple backticks).
- Only produce yaml strings enclosed in double quotes (\"...\") 
- Produce the yaml string values in the language the release notes are in, and enter the language code (ISO 639-1) in the \`langCode\` field.

The yaml should follow the following zod schema when converted to json:

\`\`\`ts
const videoPropsSchema = z.object({
    langCode: z.string(),
    topChanges: z.array(z.object({title: string, description: string})).minLength(1),
    allChanges: z.array(string()).minLength(1).maxLength(25)
})
\`\`\`
`;

export const translations = {
  HERE_ARE_THE_TOP_CHANGES: {
    zh: "这里是最主要的更改",
    es: "Aquí están los cambios más importantes",
    en: "Here are the top changes",
    hi: "यहाँ शीर्ष परिवर्तन हैं",
    ar: "هنا أبرز التغييرات",
    pt: "Aqui estão as principais alterações",
    bn: "এখানে শীর্ষ পরিবর্তনগুলি রয়েছে",
    ru: "Вот главные изменения",
    ja: "ここにはトップの変更点があります",
    pa: "ਇੱਥੇ ਸਿਖਰ ਤੇ ਬਦਲਾਅ ਹਨ",
    de: "Hier sind die wichtigsten Änderungen",
    jv: "Ing kene ana owah-owahan paling dhuwur",
    te: "ఇక్కడ ఉన్నాయి టాప్ మార్పులు",
    vi: "Đây là những thay đổi hàng đầu",
    ko: "여기에는 주요 변경 사항이 있습니다",
    mr: "येथे मुख्य बदल आहेत",
    tr: "İşte en önemli değişiklikler",
    ta: "இங்கே மேல் மாற்றங்கள் உள்ளன",
    ur: "یہاں ہیں سب سے اوپر تبدیلیاں",
    gu: "અહીં ટોચની ફેરફારો છે",
    fa: "در اینجا تغییرات برتر هستند",
  },
  CHECK_OUT_THE_LATEST_RELEASE: {
    zh: "查看最新版本",
    es: "Consulta la última versión",
    en: "Check out the latest release",
    hi: "नवीनतम रिलीज़ की जांच करें",
    ar: "تحقق من الإصدار الأخير",
    pt: "Confira o último lançamento",
    bn: "সর্বশেষ রিলিজটি দেখুন",
    ru: "Проверьте последний релиз",
    ja: "最新のリリースをチェックしてください",
    pa: "ਨਵੀਨਤਮ ਰਿਲੀਜ਼ ਦੀ ਜਾਂਚ ਕਰੋ",
    de: "Sehen Sie sich die neueste Version an",
    jv: "Mriksa rilis paling anyar",
    te: "తాజా విడుదలను తనిఖీ చేయండి",
    vi: "Kiểm tra bản phát hành mới nhất",
    ko: "최신 릴리즈 확인",
    mr: "नवीनतम सूत्रीकरण तपासा",
    tr: "En son sürümü kontrol edin",
    ta: "சமீபத்திய வெளியீட்டை சரிபார்க்கவும்",
    ur: "تازہ ترین ریلیز کی جانچ پڑتال کریں",
    gu: "નવીનતમ રીલીઝ તપાસો",
    fa: "آخرین انتشار را بررسی کنید",
  },
  ON_GITHUB: {
    zh: "在GitHub上",
    es: "En GitHub",
    en: "On GitHub",
    hi: "GitHub पर",
    ar: "على GitHub",
    pt: "No GitHub",
    bn: "GitHub এ",
    ru: "На GitHub",
    ja: "GitHubで",
    pa: "ਗਿੱਟਹਬ ਤੇ",
    de: "Auf GitHub",
    jv: "Ing GitHub",
    te: "గిట్‌హబ్‌లో",
    vi: "Trên GitHub",
    ko: "GitHub에서",
    mr: "GitHub वर",
    tr: "GitHub'da",
    ta: "GitHub இல்",
    ur: "گٹ ہب پر",
    gu: "GitHub પર",
    fa: "در GitHub",
  },
  HERES_ALL_THE_STUFF_ADDED: {
    zh: "这是所有添加的内容！",
    es: "¡Aquí está todo lo que se añadió!",
    en: "Here's all the stuff added!",
    hi: "यह सभी जोड़े गए सामग्री हैं!",
    ar: "ها هي كل الأشياء التي تمت إضافتها!",
    pt: "Aqui está tudo o que foi adicionado!",
    bn: "এখানে সব যোগ করা জিনিস রয়েছে!",
    ru: "Вот все добавленное!",
    ja: "これが追加されたすべてのものです！",
    pa: "ਇਹ ਸਾਰੀਆਂ ਸ਼ੀਜ਼ਾਂ ਹਨ ਜੋ ਸ਼ਾਮਲ ਕੀਤੀਆਂ ਗਈਆਂ ਹਨ!",
    de: "Hier ist alles, was hinzugefügt wurde!",
    jv: "Ing kene kabeh barang sing ditambahake!",
    te: "ఇది అన్నిటినీ జతచేయబడింది!",
    vi: "Đây là tất cả những thứ đã được thêm vào!",
    ko: "추가된 모든 것이 여기 있습니다!",
    mr: "येथे सर्व जोडलेली गोष्टी आहेत!",
    tr: "İşte eklenen tüm şeyler!",
    ta: "இதோ அனைத்து சேர்க்கப்பட்ட பொருட்களும் உள்ளன!",
    ur: "یہ ہے سب کچھ شامل کیا گیا!",
    gu: "અહીં બધું ઉમેરાયેલું છે!",
    fa: "این همه چیز اضافه شده است!",
  },
};
