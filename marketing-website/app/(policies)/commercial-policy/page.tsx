import { PolicyPage } from '@/components/policy/PolicyPage';

export default function CommercialPolicyPage() {
  return (
    <PolicyPage title="特定商取引法に基づく表記" lastUpdated="2024年12月3日">
      <section>
        <h2>事業者情報</h2>
        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-3 pr-4 font-semibold w-1/3">販売業者</td>
              <td className="py-3">クロハコ</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-3 pr-4 font-semibold">サービス名</td>
              <td className="py-3">ファクシー (Faxi)</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-3 pr-4 font-semibold">代表者</td>
              <td className="py-3">ウィルソン ロバート</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-3 pr-4 font-semibold">所在地</td>
              <td className="py-3">〒154-0004 東京都世田谷区太子堂4丁目18番15号マガザン三軒茶屋2 3F-3</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-3 pr-4 font-semibold">電話番号</td>
              <td className="py-3">050-5050-9685</td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-3 pr-4 font-semibold">メール</td>
              <td className="py-3"><a href="mailto:info@kurohako.co" className="text-faxi-brown hover:underline">info@kurohako.co</a></td>
            </tr>
            <tr className="border-b border-gray-200">
              <td className="py-3 pr-4 font-semibold">URL</td>
              <td className="py-3"><a href="https://faxi.jp" className="text-faxi-brown hover:underline">https://faxi.jp</a></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>販売価格・料金</h2>
        <p>
          当サービスでは、サブスクリプション（月額・年額プラン）および従量課金制を提供しています。
        </p>
        <p>追加費用：</p>
        <ul>
          <li>送料：全国一律690円（離島・一部地域は1,500円～3,000円）</li>
          <li>代金引換手数料：300円</li>
          <li>銀行振込手数料：お客様負担</li>
        </ul>
      </section>

      <section>
        <h2>支払い方法</h2>
        <ul>
          <li>クレジットカード（オンラインのみ、購入時に決済）</li>
          <li>コンビニ払い（3日以内）</li>
          <li>代金引換（配達時に支払い）</li>
        </ul>
      </section>

      <section>
        <h2>商品の引き渡し時期</h2>
        <p>
          デジタル製品は支払い完了後、即時ご利用いただけます。物理的な商品の納期は各商品ページに記載しています。
        </p>
      </section>

      <section>
        <h2>返品・キャンセル</h2>
        <p>
          デジタル製品は返品できません。物理的な商品で欠陥がある場合は、商品到着後7日以内であれば交換が可能です。お客様都合による返品はお受けできません。キャンセルは発送前のみ可能です。
        </p>
      </section>
    </PolicyPage>
  );
}
