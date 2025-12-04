import { PolicyPage } from '@/components/policy/PolicyPage';

export default function RefundReturnsPage() {
  return (
    <PolicyPage title="返品・返金ポリシー" lastUpdated="2024年12月3日">
      <section>
        <h2>1. 返品条件</h2>
        <p>以下の場合のみ返品を受け付けます：</p>
        <ul>
          <li>商品が到着時に不良品、破損している、または欠陥がある場合</li>
          <li>注文と異なる商品が発送された場合</li>
        </ul>
        <p>
          お客様は商品到着後<strong>7日以内</strong>に当社にご連絡ください。商品は未使用で、元の状態および元のパッケージのままである必要があります。
        </p>
      </section>

      <section>
        <h2>2. 返品不可の商品</h2>
        <p>以下の場合は返品をお受けできません：</p>
        <ul>
          <li>お客様都合（イメージ違い、サイズ不一致、注文間違いなど）</li>
          <li>デジタル製品およびサブスクリプションサービス</li>
          <li>「最終セール」または「返品不可」と明記された商品</li>
          <li>受取後に使用または改変された商品</li>
        </ul>
      </section>

      <section>
        <h2>3. 返品手続き</h2>
        <p>
          商品を返品する前に、当社に連絡して承認を得る必要があります。無断返品は受け付けられません。
        </p>
      </section>

      <section>
        <h2>4. 返金処理</h2>
        <p>
          検品後、当社が返金の可否を判断します。承認された返金は、元の支払い方法で<strong>10営業日以内</strong>に処理されます。
        </p>
      </section>

      <section>
        <h2>5. 送料</h2>
        <ul>
          <li>不良品または当社の誤発送の場合：当社が返送料を負担</li>
          <li>その他の理由：返品はお受けできません</li>
        </ul>
      </section>

      <section>
        <h2>6. 第三者サプライヤーの条件</h2>
        <p>
          当社はTopSellerおよびその他のサプライヤーの条件に従っており、返品資格が制限される場合があります。
        </p>
      </section>

      <section>
        <h2>お問い合わせ</h2>
        <p>
          <strong>会社名：</strong>クロハコ<br />
          <strong>メール：</strong><a href="mailto:info@faxi.jp" className="text-faxi-brown hover:underline">info@faxi.jp</a><br />
          <strong>FAX：</strong>050-5050-9685
        </p>
      </section>
    </PolicyPage>
  );
}
