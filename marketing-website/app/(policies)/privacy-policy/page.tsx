import { PolicyPage } from '@/components/policy/PolicyPage';

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage title="プライバシーポリシー" lastUpdated="2024年12月3日">
      <section>
        <p>
          <strong>サービス提供者：</strong>クロハコ<br />
          <strong>サービス名：</strong>Faxi
        </p>
      </section>

      <section>
        <h2>個人情報の収集</h2>
        <p>
          当社は、ファックス送信、ウェブサイトからのメッセージ、アカウント登録、注文、お問い合わせを通じて、サービス提供に必要な情報を収集します。
        </p>
      </section>

      <section>
        <h2>データの利用</h2>
        <p>
          個人データは、製品およびサービスの提供、サービス改善、お客様のご要望への対応に使用されます。これには、ファックス内容のメールへのデジタル変換、オンライン注文、その他のデジタルサービスが含まれます。
        </p>
      </section>

      <section>
        <h2>データの共有</h2>
        <p>
          法律で義務付けられている場合を除き、第三者への開示には同意が必要です。ファックス内容は必要な範囲でのみ使用されます。個人を特定しないデータは外部パートナーに提供される場合があります。
        </p>
      </section>

      <section>
        <h2>ファックスデータの保存</h2>
        <p>
          当社は、サービス改善、データ分析、機械学習のためにファックスデータを保持します。データは分析のために匿名化され、分析および学習に必要な期間保存されます。
        </p>
      </section>

      <section>
        <h2>Cookieの使用</h2>
        <p>
          当サイトでは、アクセス分析およびサービス向上のためにCookieを使用しています。ユーザーはブラウザの設定でCookieを無効にすることができます。
        </p>
      </section>

      <section>
        <h2>ユーザーの権利</h2>
        <p>
          お客様は、個人情報の開示、訂正、または利用停止を<a href="mailto:info@kurohako.co" className="text-faxi-brown hover:underline">info@kurohako.co</a>にご連絡いただくことで請求することができます。
        </p>
      </section>

      <section>
        <h2>ポリシーの更新</h2>
        <p>
          改訂はウェブサイトへの掲載をもって有効となります。
        </p>
      </section>
    </PolicyPage>
  );
}
