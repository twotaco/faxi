import { PolicyPage } from '@/components/policy/PolicyPage';

export default function CookiePolicyPage() {
  return (
    <PolicyPage title="クッキーポリシー" lastUpdated="2024年12月3日">
      <section>
        <p>
          <strong>サービス提供者：</strong>クロハコ<br />
          <strong>サービス名：</strong>ファクシー (Faxi)
        </p>
      </section>

      <section>
        <h2>概要</h2>
        <p>
          Faxiは、ウェブサイトの基本機能、ユーザー体験の向上、および将来的な分析・マーケティング目的でCookieを使用しています。ウェブサイトにアクセスすることで、Cookieの使用に同意したものとみなされます。
        </p>
      </section>

      <section>
        <h2>1. 必須Cookie</h2>
        <p>
          必須Cookieは、ショッピングカートの管理、チェックアウトプロセス、ユーザーセッションの維持など、ウェブサイトの基本機能をサポートするものです。
        </p>
      </section>

      <section>
        <h2>2. 分析Cookie</h2>
        <p>
          当社は、訪問者がサイトとどのようにやり取りするかを理解するために分析Cookieを使用しています。ページ訪問数や滞在時間などの指標を追跡し、ウェブサイトの機能とユーザー体験を向上させます。
        </p>
      </section>

      <section>
        <h2>3. マーケティングCookie</h2>
        <p>
          将来的には、閲覧履歴に基づいてパーソナライズされた広告を配信するマーケティングCookieを使用し、ユーザーに関連性の高いコンテンツを表示する場合があります。
        </p>
      </section>

      <section>
        <h2>4. Cookieの管理</h2>
        <p>
          ユーザーはブラウザの設定でCookieを管理または無効にすることができます。ただし、必須Cookieを無効にすると、ショッピングカートやチェックアウト機能に影響を与える場合があります。設定の詳細については、ブラウザのヘルプ機能をご参照ください。
        </p>
      </section>

      <section>
        <h2>同意について</h2>
        <p>
          このウェブサイトを引き続きご利用いただくことで、当サイトのクッキーポリシーに従い、Cookieの使用に同意したものとみなされます。
        </p>
      </section>
    </PolicyPage>
  );
}
