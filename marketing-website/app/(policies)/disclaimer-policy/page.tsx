import { PolicyPage } from '@/components/policy/PolicyPage';

export default function DisclaimerPolicyPage() {
  return (
    <PolicyPage title="免責事項" lastUpdated="2024年12月3日">
      <section>
        <h2>概要</h2>
        <p>
          クロハコは、健康、フィットネス、金融、ライフスタイル分野にわたるAI対応情報を提供するデジタルサービス「Faxi」を運営しています。本サービスの利用により、以下の条件に同意したものとみなされます。
        </p>
      </section>

      <section>
        <h2>1. 情報提供のみを目的</h2>
        <p>
          AIエージェントの回答および推奨事項は、一般的な情報提供を目的としています。本サービスは専門的なアドバイスを構成するものではありません。個別のガイダンスが必要なユーザーは、資格を持つ専門家にご相談ください。
        </p>
      </section>

      <section>
        <h2>2. 専門家関係の不存在</h2>
        <p>
          サービスの利用により、ユーザーとクロハコの間に専門家関係が成立するものではありません。当社はAIの推奨に基づく行動について責任を負いません。重要な決定には専門家への相談が必要です。
        </p>
      </section>

      <section>
        <h2>3. AIの限界</h2>
        <p>
          AIは、すべてのケースにおいて正確、最新、または関連性があることを保証するものではありません。回答は利用可能なデータとアルゴリズムから導出されますが、専門家の知識を完全に再現することはできません。クロハコは、完全性、正確性、信頼性について一切の保証をいたしません。
        </p>
      </section>

      <section>
        <h2>4. 第三者コンテンツに関する免責</h2>
        <p>
          本サービスには、外部リンクおよびリソースの推奨が含まれる場合があります。クロハコは、第三者のコンテンツ、製品、またはサービスについて責任を負わず、その正確性や信頼性を保証することはできません。
        </p>
      </section>

      <section>
        <h2>5. 責任制限</h2>
        <p>
          当社は、AIの回答、推奨、または第三者リンクから生じる直接的、間接的、付随的、または結果的な損害（データ損失、身体的傷害、経済的損害を含む）について責任を負いません。
        </p>
      </section>

      <section>
        <h2>6. ポリシーの変更</h2>
        <p>
          クロハコはこの免責事項を変更する権利を留保します。更新されたポリシーはウェブサイトに掲載された時点で直ちに有効となります。
        </p>
      </section>

      <section>
        <h2>お問い合わせ</h2>
        <p>
          <strong>組織：</strong>クロハコ<br />
          <strong>サービス：</strong>Faxi<br />
          <strong>メール：</strong><a href="mailto:info@kurohako.co" className="text-faxi-brown hover:underline">info@kurohako.co</a>
        </p>
      </section>
    </PolicyPage>
  );
}
