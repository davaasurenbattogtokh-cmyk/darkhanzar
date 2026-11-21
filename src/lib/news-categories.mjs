// Business news sections. Shared by the server (validation) and the site (navigation).
export const newsCategories=[
 {id:'economy',label:'Эдийн засаг'},
 {id:'business',label:'Бизнес'},
 {id:'finance',label:'Санхүү, банк'},
 {id:'local',label:'Орон нутаг'},
 {id:'tech',label:'Технологи'},
 {id:'world',label:'Дэлхийд'},
 {id:'interview',label:'Ярилцлага'},
];
export const newsCategoryLabel=id=>newsCategories.find(c=>c.id===id)?.label||'Мэдээ';
