# Development

Uygulama akışı tarayıcı → merkezi `api` katmanı → VEXOR API şeklindedir. Bileşenlere sabit API adresi eklemeyin. Sayfalar route bazında lazy yüklenir; yeni ağır modüller ana bundle'a doğrudan import edilmemelidir.

Kullanıcı arayüzü `OWNER`, `ADMIN`, `ACCOUNTING_OPERATIONS`, `ACCOUNTING_OPERATOR` ve `MEMBER` rollerinde en az yetki ilkesini izler. Dil seçimi role bağlı değildir. Kullanıcı ve çalışan kavramları arayüzde ayrı tutulur.

Yeni metinleri üç dil kataloğuna ekleyin, `npm run i18n:check` ile anahtar eşitliğini doğrulayın. Para birimi DZD kalır; tarih ve sayı biçimleri aktif locale'i kullanır.

