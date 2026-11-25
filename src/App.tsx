import LeadForm from './components/LeadForm';

// 全部为虚构的演示数据，不含任何真实个人信息、企业信息或客户名称。
export default function App() {
  return (
    <main style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1>新建线索</h1>
      <p>
        会员空间平台 · 业务员工作台 v1（演示页，接口为 mock；对接点见 README）。
      </p>
      <p>
        演示触发词：企业名称含「强占」为 strong 归属他人；含「公海」为 strong 在公海；
        含「疑似」为 weak 疑似重复；提交时含「撞单」「在池」「超限」分别触发
        LEAD_COLLISION、LEAD_IN_POOL、LEAD_HOLDING_LIMIT。
      </p>
      <LeadForm />
    </main>
  );
}
