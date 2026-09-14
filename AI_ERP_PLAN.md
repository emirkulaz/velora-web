# VEXOR ERP yapay zekâ geliştirme planı

## Bu depoda uygulanan temel
- Türkçe, Fransızca ve Arapça ERP sözlüğüyle tek harf ve harf sırası hataları için isteğe bağlı taslak önerisi.
- Aksan, Türkçe harfler ve Arapça harekeler yalnız karşılaştırma için normalize edilir. Sayılar ve SKU benzeri kodlar korunur. Birden çok eşleşmede öneri yapılmaz.
- Orijinal mesaj mevcut API'ye gider. Öneri ancak kullanıcı seçerse taslağa geçer; müşteri adları otomatik değiştirilmez.
- Sesli giriş aktif arayüz dilini kullanır. Arapça asistan metinleri ve hazır sorular eklendi.

Bu sözlük anlamsal model değildir. Lehçeler, uzun yazım hataları, karma diller ve bağlam çözümleme için aşağıdaki sunucu işi gereklidir. Bu depoda sunucu kodu bulunmuyor; yeni sözleşme henüz API'ye gönderilmiyor.

## Sunucuda işlem akışı
1. Orijinal mesajı ve oturumu sakla; TR/FR/AR veya karma dili belirle. Yanıt dilini kullanıcının talebinden, ardından konuşma dilinden seç.
2. Modelle yapılandırılmış niyet çıkar: modüller, okuma/yazma, dönem, müşteri/ürün, miktar, birim, para birimi, olumsuzlama, eksik alanlar. Yazım ve Cezayir Arapçası varyantlarını bağlam içinde çöz.
3. Müşteri, ürün ve tedarikçiyi yalnız yetkili ERP kayıtlarında ara. Tam kod eşleşmesini öncele; benzer adları aday göster. İki aday veya eksik miktar varsa kısa açıklayıcı soru sor. Modelin güven puanına tek başına dayanma.
4. Planı bağımlı adımlara ayır: veriyi al → hesapla → kaynağı doğrula → yanıtla/önizle. Araçlar izinli şemalar kullanmalı; serbest SQL veya model üretimi endpoint çalıştırılmamalı.
5. Okumalarda canlı araç verisini kullan. Veri yoksa sayı üretme. Tarih aralığı, saat dilimi, kaynak ve kayıt sayısını döndür. Tutarları sunucuda kesin ondalık hesapla.
6. Yazmalarda doğrulanmış önizleme tokenı üret. Token kullanıcı, firma, işlem ve veri sürümüne bağlı, kısa ömürlü ve tek kullanımlık olmalı. Onayda yetki ve stok tekrar doğrulansın. Belirsiz/olumsuz talep işlem başlatmasın.
7. Çok adımlı yazmada transaction veya açık telafi stratejisi kullan; kısmi başarıyı belirt. Aynı onay tekrar gönderilirse ikinci kayıt üretme. Denetim izi tut.

## Önerilen sürümlü API sözleşmesi
Mevcut `message` ve `conversationId` korunur. Sunucu desteği çıktıktan sonra `/ai/chat` ve finans akışına `understandingVersion: 1` ile `locale` eklenebilir.

Yanıt uzantısı: `understanding: { language, interpretedRequest, intent, entities, missingFields, clarificationQuestion }` ve `plan: [{ id, description, status }]`.
Durumlar: `pending`, `running`, `completed`, `failed`, `needs_clarification`. Plan ve açıklama kullanıcıya gösterilir; araçların teknik ayrıntıları akışa konmaz. Mevcut `writePreview` ve `evidence` korunur. Yetkilendirme sunucuda yapılır.

## Uygulama sırası
1. Sunucu deposunda niyet şeması, çok dilli istem ve kayıt eşleştirme araçlarını ekle.
2. Önce kasa, stok ve sipariş okuma araçlarıyla değerlendirme yap.
3. Eksik bilgi diyaloğu ve konuşma bağlamını firma/kullanıcı bazında ekle.
4. Onaylı stok/sipariş yazmalarını transaction ve tek kullanımlık tokenla ekle.
5. Plan durumlarını arayüze bağla; pilot kullanım sonuçlarına göre kapsamı genişlet.

## Kalite kapısı (hedefler, ölçülmüş sonuçlar değil)
Her dil için en az 100 bağımsız senaryo: temiz ifade, yazım hatası, aksansız yazım, Arapça hareke/lehçe, karma dil, takip sorusu, benzer müşteri adları, olumsuzlama, tarih, miktar ve yetki reddi.
- Niyet doğruluğu her dilde ≥ %95; yazım hatalı grupta ≥ %90.
- Kod, miktar, para birimi ve olumsuzlama korunması test kümesinde %100.
- Belirsiz müşteri/üründe açıklama isteme %100; onaysız yazma ve başka firmadan veri sızıntısı 0.
- Finans sonuçları ERP hesaplarıyla birebir uyuşmalı; uydurulmuş veri 0.
- Tekrarlanan onay, zaman aşımı, eski önizleme ve eşzamanlı stok değişimi ayrı entegrasyon testleriyle doğrulanmalı.
Örnekler: “kasda ne kdar var”, “combien reste dans la caise”, “شحال كاين في الصندوق”, “Aliye ١٢٥ kg stok çıkma”, “aynısını geçen ay için göster”. Son iki örnekte miktarı/olumsuzlamayı ve önceki bağlamı korumak zorunlu.
