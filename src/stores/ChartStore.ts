import { action, computed, observable, runInAction } from 'mobx';
import * as helpers from '../utils/gettingData';
import * as chartjs from 'chart.js';
import { HistoricalPeriod, HistoryFetchedData, RootStore } from '../interfaces';

type ActionState = 'pending' | 'done' | 'error';

class ChartStore {

  colors: chartjs.ChartColor = [
    'rgba(126, 65, 73, 0.4)',
    'rgba(138, 92, 123, 0.4)',
    'rgba(118, 129, 167, 0.4)',
    'rgba(73, 167, 185, 0.4)',
    'rgba(69, 200, 170, 0.4)',
    'rgba(144, 225, 134, 0.4)',
    'rgba(239, 238, 105, 0.4)'
  ];
  nextColor: number = 0;

  @observable chartType: chartjs.ChartType;
  @observable cData: chartjs.ChartData;
  @observable _historicalPeriod: HistoricalPeriod;
  state: ActionState; // 'pending' / 'done' / 'error'

  protected rootStore: RootStore;

  constructor(rootStore: any) {
    this.rootStore = rootStore;
    this.state = 'pending';
    this.chartType = 'line';
    this.cData = {
      datasets: [
        {
          data: [3, 2, 1, 4, 2, 5, 1, 8, 7, 10],
          label: 'Default chart',
          fill: true
        }
      ],
      labels: [
        '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
      ]
    };
    this._historicalPeriod = 'alltime';
  }

  @computed get getHistoricalPeriod() {
    return this._historicalPeriod;
  }

  @action setHistoricalPeriod(period: HistoricalPeriod) {
    this._historicalPeriod = period;
  }

  /**
   * Устанавливает выбрнные тип графика. График рендерится заново, структура данных должна немного поменяться.
   * @param {Chart.ChartType} type
   */
  @action setChartType(type: chartjs.ChartType) {
    this.chartType = type;
    console.log('Тип графика теперь ', this.chartType);
  }

  /**
   * Асинхронно забирает данные с сервера bitcoinaverage.com через их API по заданным параметрам.
   * Возвращает все данные об определенной криптовалюте в заданной валюте
   * @param {string} crypto
   * @param {string} currency
   * @param {string[]} parameters
   * @returns {Promise<void>}
   */
  @action
  async fetch(crypto: string, currency: string, parameters: string[]) {
    this.state = 'pending';
    try {
      const data = await helpers.getDataAboutCrypto(crypto, currency);
      // const numbers = [1,2,3,4,5];
      runInAction('logging fetched data', () => {
        // console.log(`fetched data: ${JSON.stringify(data, null, '\t')}`);
        parameters.forEach((value, index) => {
          console.log(`${value}: ${data[value]}`);
        });
        this.cData.datasets[0].data[0] = data.averages.day;
        this.state = 'done';
      });
    } catch {
      runInAction(() => {
        this.state = 'error';
        throw (Error('Не получилось получить данные (fetch в ChartStore). Проверьте подключение к интернету.'));
      });
    }
  }

  /**
   * Асинхронно забирает исторические данные с сервера bitcoinaverage.com через их API.
   * Возвращает исторические данные об определенной криптовалюте в заданной валюте за заданный исторический промежуток
   * @param {string} crypto - криптовалюта
   * @param {string} currency - валюта
   * @param {"daily" | "monthly" | "alltime" | number} period - период, за который получаем данные
   * @returns {Promise<void>}
   */
  @action
  async historicalFetch(crypto: string, currency: string, period: '' | 'alltime' | 'daily' | 'monthly') {
    this.state = 'pending';
    try {
      const UserStore = this.rootStore.UserStore;
      let numberOfResults = this.rootStore.UserStore.getNumResults;
      if (numberOfResults <= 1) {
        throw new RangeError('Number of requested results will be 1 or more');
      }
      let fetchedData = [];
      for (let i = 0; i < UserStore.getCrypto.length; i++) {
        console.log(`ChartStore| Loading data for crypto: ${UserStore._crypto[i]}.`);
        fetchedData.push(await helpers.getHistoricalDataAboutCrypto(UserStore.getCrypto[i], UserStore._currency, this.getHistoricalPeriod));
      }
      let slicedData: Array<any>;
      slicedData = fetchedData.map((value: void, index: number, array: any) => {
        return array[index].slice(0, numberOfResults).reverse();
      });
      console.log(slicedData);

      runInAction('Erasing old chart data', () => {
        this.cData.datasets.splice(0, this.cData.datasets.length);
        this.cData.labels.splice(0, this.cData.labels.length);
        this.nextColor = 0;
      });

      runInAction('Add new data to chart', () => {
        slicedData.forEach((data: HistoryFetchedData[], index: number) => {
          let newData: number[] = data.map((item: HistoryFetchedData) => {
            return item.average;
          });
          let newLabels: string[] = data.map((item: HistoryFetchedData) => {
              switch (this.getHistoricalPeriod) {
                case 'alltime':
                  return item.time.slice(0, 10);
                case 'monthly' || 'daily':
                  return item.time.slice(5, 16);
                default:
                  return item.time;
              }
            }
          );
          let newLegend: string = this.rootStore.UserStore.getCrypto[index];

          this.addChartDataToDataset(newData, newLabels, newLegend);
        });
      });
      this.state = 'done';
    } catch (err) {
      runInAction('Catch error', () => {
        this.state = 'error';
        alert(err.message);
      });
    }
  }

  @action addChartDataToDataset(data: number[], labels: Array<string | string[]>, legend: string) {
    const newDataset: chartjs.ChartDataSets = {
      data: data,
      label: legend,
      backgroundColor: this.colors[this.nextColor],
      hoverBackgroundColor: this.colors[this.nextColor]
    };
    this.nextColor++;
    this.cData.datasets.push(newDataset);
    this.cData.labels = labels;
  }
}

export default ChartStore;