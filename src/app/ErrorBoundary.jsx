import React from 'react';
import * as I from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={hasError:false,error:null};
  }
  static getDerivedStateFromError(error){
    return {hasError:true,error};
  }
  componentDidCatch(error,info){
    console.error('GENIUS ADMIN UNHANDLED UI ERROR',error,info);
    try{
      window.dispatchEvent(new CustomEvent('genius-admin-error',{detail:{message:String(error?.message||error)}}));
    }catch{}
  }
  retry=()=>this.setState({hasError:false,error:null});
  render(){
    if(!this.state.hasError)return this.props.children;
    return <div className="fatal" dir="rtl">
      <div className="fatalCard">
        <div className="fatalIcon"><I.ShieldAlert size={28}/></div>
        <h1>GENIUS ADMIN استعاد نفسه</h1>
        <p>حدث خطأ غير متوقع في الواجهة. بياناتك المحلية لم يتم حذفها.</p>
        <div className="actions" style={{justifyContent:'center'}}>
          <button className="btn" onClick={this.retry}><I.RefreshCw size={15}/> إعادة المحاولة</button>
          <button className="btn secondary" onClick={()=>window.location.reload()}><I.RotateCcw size={15}/> إعادة تشغيل التطبيق</button>
        </div>
        <small style={{display:'block',marginTop:12,color:'var(--muted)',fontSize:8}}>
          {this.state.error?.message ? `تفاصيل: ${this.state.error.message}` : 'يمكنك إعادة المحاولة بأمان.'}
        </small>
      </div>
    </div>;
  }
}
