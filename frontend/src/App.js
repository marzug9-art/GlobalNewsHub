<select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="filter-select">
  <option value="">🌍 كل المصادر</option>
  
  <optgroup label="🇶🇦🇦🇦🇪 عربية وخليجية">
    <option value="الجزيرة">الجزيرة (قطر)</option>
    <option value="العربية">العربية (السعودية)</option>
    <option value="Sky News Arabia">Sky News Arabia (الإمارات)</option>
    <option value="BBC عربي">BBC عربي</option>
    <option value="فرانس 24 عربي">فرانس 24 عربي</option>
    <option value="RT عربي">RT عربي</option>
    <option value="DW عربي">DW عربي</option>
    <option value="مونت كارلو">مونت كارلو</option>
    <option value="الأناضول">الأناضول (تركيا)</option>
    <option value="عكاظ">عكاظ (السعودية)</option>
    <option value="القدس العربي">القدس العربي</option>
    <option value="عربي21">عربي21 (قطر)</option>
    <option value="الخليج">الخليج (الإمارات)</option>
    <option value="البيان">البيان (الإمارات)</option>
  </optgroup>
  
  <optgroup label="🇬🇧 بريطانية">
    <option value="BBC">BBC</option>
    <option value="The Guardian">The Guardian</option>
  </optgroup>
  
  <optgroup label="🇺🇸 أمريكية">
    <option value="CNN">CNN</option>
    <option value="New York Times">New York Times</option>
    <option value="AP News">AP News</option>
    <option value="Washington Post">Washington Post</option>
    <option value="Bloomberg">Bloomberg</option>
  </optgroup>
  
  <optgroup label="🇪 أوروبية">
    <option value="Le Monde">Le Monde (فرنسا)</option>
    <option value="Euronews">Euronews</option>
    <option value="Deutsche Welle">Deutsche Welle (ألمانيا)</option>
  </optgroup>
  
  <optgroup label=" آسيوية">
    <option value="NHK World">NHK World (اليابان)</option>
    <option value="China Daily">China Daily (الصين)</option>
    <option value="Press TV">Press TV (إيران)</option>
  </optgroup>
  
  <optgroup label="🌍 عالمية">
    <option value="Haaretz">Haaretz (إسرائيل)</option>
    <option value="Times of Israel">Times of Israel</option>
    <option value="Reuters">Reuters (عالمي)</option>
    <option value="Al Jazeera English">Al Jazeera English</option>
  </optgroup>
</select>