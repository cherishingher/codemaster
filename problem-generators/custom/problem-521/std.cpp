// problem-521 / 拯救世界
// Uploaded standard solution for local testdata generation should not depend on freopen.
#include <bits/stdc++.h>
#define fp(i,a,b) for(int i=(a),I=(b)+1;i<I;++i)
#define fd(i,a,b) for(int i=(a),I=(b)-1;i>I;--i)
#define ll long long
using namespace std;
const int mod=998244353;
const int inv3=332748118;
const int M=6e5+3;
typedef ll arr[M];
char sr[1<<21],z[20];int C=-1,Z;
inline void Ot(){fwrite(sr,1,C+1,stdout),C=-1;}
inline void print(ll x){ if(C>1<<20)Ot();
	while(z[++Z]=x%10+48,x/=10);
    while(sr[++C]=z[Z],--Z);
} int limit=1,n,len,len1,len2,len3,len4;
arr r,n1,n2,n3,n4,ans; char s[M];
inline int mul(int x,int y){return 1ll*x*y%mod;}
inline int inc(ll x,ll y){return x+y>=mod?x+y-mod:x+y;}
inline int dec(ll x,ll y){return x-y<0?x-y+mod:x-y;}
inline int qpow(int x,int p=mod-2){ int s=1;
	for(;p;p>>=1,x=mul(x,x))
		if(p&1) s=mul(s,x); return s;
}
inline void NTT(ll* a,int tp){
	fp(i,0,limit-1) if(i<r[i]) swap(a[i],a[r[i]]);
	for(int mid=1,x,y;mid<limit;mid<<=1){
		int Gn=qpow(tp?3:inv3,(mod-1)/(mid<<1));
		for(int j=0;j<limit;j+=mid<<1)
			for(int k=0,g=1;k<mid;++k,g=mul(g,Gn))
				x=a[j+k],y=mul(g,a[j+k+mid]),
				a[j+k]=inc(x,y),a[j+k+mid]=dec(x,y);
	} if(tp) return ; int inv=qpow(limit);
	fp(i,0,limit-1) a[i]=a[i]*inv%mod;
}
inline void Mul(ll* a,ll* b){
	NTT(a,1),NTT(b,1);
	fp(i,0,limit-1)
		a[i]=a[i]*b[i]%mod;
	NTT(a,0); ll tmp=0;
	fp(i,0,limit-1){
		a[i]+=tmp,
		tmp=a[i]/10,
		a[i]%=10;
		if(a[i]) len1=i+1;
	}
}
int main(){
	scanf("%s",s); ll n=strlen(s),x=1;
	for(;limit<=4e5;limit<<=1) ++len;
	fp(i,0,limit) r[i]=r[i>>1]>>1|((i&1)<<len-1);
	reverse(s,s+n); fp(i,0,n-1) n1[i]=s[i]-48;
	fp(i,0,n){ n1[i]=n1[i]+x;
		x=n1[i]/10,n1[i]%=10;
		if(n1[i]) len1=i+1;
	} x=1;
	fp(i,0,len1-1){ n2[i]=n1[i]+x;
		x=n2[i]/10,n2[i]%=10;
		if(n2[i]) len2=i+1;
	} x=1;
	fp(i,0,len2-1){ n3[i]=n2[i]+x;
		x=n3[i]/10,n3[i]%=10;
		if(n3[i]) len3=i+1;
	} x=1;
	fp(i,0,len3-1){ n4[i]=n3[i]+x;
		x=n4[i]/10,n4[i]%=10;
		if(n4[i]) len4=i+1;
	} x=1;
	Mul(n1,n2),Mul(n1,n3),Mul(n1,n4);
	ll p=0,lenn=0;
	fd(i,len1-1,0){
		p=p*10+n1[i],ans[i]=p/24,p%=24;
		if(ans[i]&&!lenn) lenn=i+1;
	}
	if(!lenn) lenn=1;
	fd(i,lenn-1,0)
		print(ans[i]);
	return Ot(),0;
}
